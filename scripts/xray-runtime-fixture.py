#!/usr/bin/env python3
"""Small stateful Xray Runtime API fixture for local regression tests."""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import signal
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse


class FixtureState:
    def __init__(self) -> None:
        self.next_inbound_id = 2
        self.inbounds: dict[int, dict[str, Any]] = {
            1: {
                "id": 1,
                "remark": "fixture-inbound",
                "port": 10001,
                "protocol": "vless",
                "enable": True,
                "settings": {"clients": []},
                "clientStats": [],
            }
        }
        self.outbounds = [{"tag": "direct", "protocol": "freedom", "settings": {}}]
        self.xray_config: dict[str, Any] = {"log": {"loglevel": "warning"}}
        self.traffic = {"up": 1024, "down": 2048}
        self.restart_count = 0

    def list_inbounds(self) -> list[dict[str, Any]]:
        return [self._clone(value) for value in self.inbounds.values()]

    def add_inbound(self, payload: dict[str, Any]) -> dict[str, Any]:
        inbound_id = int(payload.get("id") or self.next_inbound_id)
        self.next_inbound_id = max(self.next_inbound_id, inbound_id + 1)
        inbound = {
            "id": inbound_id,
            "remark": payload.get("remark", f"fixture-inbound-{inbound_id}"),
            "port": int(payload.get("port") or 10000 + inbound_id),
            "protocol": payload.get("protocol", "vless"),
            "enable": bool(payload.get("enable", True)),
            "settings": self._normalize_settings(payload.get("settings", {})),
            "clientStats": payload.get("clientStats", []),
        }
        self.inbounds[inbound_id] = inbound
        return self._clone(inbound)

    def update_inbound(self, inbound_id: int, payload: dict[str, Any]) -> dict[str, Any] | None:
        inbound = self.inbounds.get(inbound_id)
        if inbound is None:
            return None
        for key in ("remark", "protocol", "clientStats"):
            if key in payload:
                inbound[key] = payload[key]
        if "port" in payload:
            inbound["port"] = int(payload["port"])
        if "enable" in payload:
            inbound["enable"] = bool(payload["enable"])
        if "settings" in payload:
            inbound["settings"] = self._normalize_settings(payload["settings"])
        return self._clone(inbound)

    def set_enabled(self, inbound_id: int, enabled: bool) -> dict[str, Any] | None:
        inbound = self.inbounds.get(inbound_id)
        if inbound is None:
            return None
        inbound["enable"] = enabled
        return self._clone(inbound)

    def delete_inbound(self, inbound_id: int) -> bool:
        return self.inbounds.pop(inbound_id, None) is not None

    def add_client(self, inbound_id: int, payload: dict[str, Any]) -> dict[str, Any] | None:
        inbound = self.inbounds.get(inbound_id)
        if inbound is None:
            return None
        client = self._client_from_payload(payload)
        inbound["settings"].setdefault("clients", []).append(client)
        inbound.setdefault("clientStats", []).append(
            {"email": client.get("email", ""), "up": 0, "down": 0, "enable": client.get("enable", True)}
        )
        return self._clone(client)

    def update_client(self, client_key: str, payload: dict[str, Any]) -> dict[str, Any] | None:
        client = self._find_client(client_key)
        if client is None:
            return None
        client.update(self._client_from_payload(payload))
        return self._clone(client)

    def delete_client(self, client_key: str) -> bool:
        for inbound in self.inbounds.values():
            clients = inbound["settings"].setdefault("clients", [])
            remaining = [
                client
                for client in clients
                if str(client.get("id")) != client_key and str(client.get("email")) != client_key
            ]
            if len(remaining) != len(clients):
                inbound["settings"]["clients"] = remaining
                return True
        return False

    def reset_client_traffic(self, client_key: str) -> bool:
        stat = self._find_client_stat(client_key)
        if stat is None:
            client = self._find_client(client_key)
            if client is None:
                return False
            stat = {"email": client.get("email", client_key), "up": 0, "down": 0, "enable": client.get("enable", True)}
            self.inbounds[1].setdefault("clientStats", []).append(stat)
        stat["up"] = 0
        stat["down"] = 0
        return True

    def _find_client(self, client_key: str) -> dict[str, Any] | None:
        for inbound in self.inbounds.values():
            for client in inbound["settings"].setdefault("clients", []):
                if str(client.get("id")) == client_key or str(client.get("email")) == client_key:
                    return client
        return None

    def _find_client_stat(self, client_key: str) -> dict[str, Any] | None:
        for inbound in self.inbounds.values():
            for stat in inbound.setdefault("clientStats", []):
                if str(stat.get("email")) == client_key or str(stat.get("id")) == client_key:
                    return stat
        return None

    @staticmethod
    def _client_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
        nested = payload.get("client") if isinstance(payload.get("client"), dict) else payload
        return {
            "id": str(nested.get("id") or nested.get("uuid") or "fixture-client"),
            "email": str(nested.get("email") or nested.get("id") or "fixture@example.test"),
            "enable": bool(nested.get("enable", True)),
            "totalGB": int(nested.get("totalGB") or 0),
        }

    @staticmethod
    def _normalize_settings(settings: Any) -> dict[str, Any]:
        if isinstance(settings, str):
            try:
                settings = json.loads(settings)
            except json.JSONDecodeError:
                settings = {}
        if not isinstance(settings, dict):
            settings = {}
        settings.setdefault("clients", [])
        return settings

    @staticmethod
    def _clone(value: Any) -> Any:
        return json.loads(json.dumps(value))


class Handler(BaseHTTPRequestHandler):
    state = FixtureState()
    api_token = ""

    def log_message(self, fmt: str, *args: Any) -> None:
        return

    def do_GET(self) -> None:
        self._route()

    def do_POST(self) -> None:
        self._route()

    def _route(self) -> None:
        parsed = urlparse(self.path)
        parts = [unquote(part) for part in parsed.path.strip("/").split("/") if part]
        body = self._read_payload()
        body_map = body if isinstance(body, dict) else {}
        method = self.command.upper()

        if parsed.path in ("/", "/healthz"):
            self._ok({"fixture": "Xray Runtime", "ok": True})
            return

        if Handler.api_token and parts[:1] == ["panel"] and not self._authorized():
            return

        if parts == ["panel", "api", "server", "status"]:
            self._ok({"cpu": 4.2, "mem": {"current": 128, "total": 1024}, "xray": {"state": "running"}})
            return

        if parts == ["panel", "api", "inbounds", "list"]:
            self._ok(Handler.state.list_inbounds())
            return

        if parts == ["panel", "api", "inbounds", "add"] and method == "POST":
            self._ok(Handler.state.add_inbound(body_map))
            return

        if len(parts) == 5 and parts[:4] == ["panel", "api", "inbounds", "update"] and method == "POST":
            self._maybe_found(Handler.state.update_inbound(self._int(parts[4]), body_map))
            return

        if len(parts) == 5 and parts[:4] == ["panel", "api", "inbounds", "del"] and method == "POST":
            self._bool_result(Handler.state.delete_inbound(self._int(parts[4])))
            return

        if len(parts) == 5 and parts[:4] == ["panel", "api", "inbounds", "setEnable"] and method == "POST":
            enabled = body_map.get("enable", body_map.get("enabled", True))
            self._maybe_found(Handler.state.set_enabled(self._int(parts[4]), bool(enabled)))
            return

        if parts == ["panel", "api", "inbounds", "addClient"] and method == "POST":
            inbound_id = self._int(str(body_map.get("id") or body_map.get("inboundId") or 1))
            self._maybe_found(Handler.state.add_client(inbound_id, body_map))
            return

        if len(parts) == 5 and parts[:4] == ["panel", "api", "inbounds", "updateClient"] and method == "POST":
            self._maybe_found(Handler.state.update_client(parts[4], body_map))
            return

        if len(parts) >= 5 and parts[:4] == ["panel", "api", "inbounds", "delClient"] and method == "POST":
            self._bool_result(Handler.state.delete_client(parts[-1]))
            return

        if len(parts) >= 5 and parts[:4] == ["panel", "api", "inbounds", "resetClientTraffic"] and method == "POST":
            self._bool_result(Handler.state.reset_client_traffic(parts[-1]))
            return

        if len(parts) >= 5 and parts[:4] == ["panel", "api", "inbounds", "delClientTraffic"] and method == "POST":
            self._bool_result(Handler.state.reset_client_traffic(parts[-1]))
            return

        if parts == ["panel", "xray", "update-style"] and method == "POST":
            Handler.state.xray_config["style"] = body
            self._ok({"saved": True})
            return

        if parts in (
            ["panel", "api", "xray", "outbounds"],
            ["panel", "api", "xray", "outbound"],
            ["panel", "api", "server", "outbounds"],
            ["panel", "xray", "outbounds"],
            ["panel", "xray", "getOutbounds"],
        ):
            if method == "POST":
                next_outbounds = body_map.get("outbounds", body if isinstance(body, list) else Handler.state.outbounds)
                if isinstance(next_outbounds, list):
                    Handler.state.outbounds = next_outbounds
            self._ok(Handler.state.outbounds)
            return

        if parts in (
            ["panel", "api", "xray", "config"],
            ["panel", "api", "server", "getConfigJson"],
            ["panel", "api", "server", "config"],
            ["panel", "xray", "config"],
            ["panel", "xray", "getXrayConfig"],
        ):
            if method == "POST":
                Handler.state.xray_config = body_map
            self._ok(Handler.state.xray_config)
            return

        if parts in (
            ["panel", "api", "server", "traffic"],
            ["panel", "api", "xray", "traffic"],
            ["panel", "api", "server", "getDb"],
            ["panel", "xray", "getOutboundsTraffic"],
        ):
            self._ok(Handler.state.traffic)
            return

        if parts in (
            ["panel", "api", "server", "restart"],
            ["panel", "api", "server", "restartXrayService"],
            ["panel", "api", "xray", "restart"],
            ["panel", "xray", "restart"],
        ) and method == "POST":
            Handler.state.restart_count += 1
            self._ok({"restarted": True, "restartCount": Handler.state.restart_count})
            return

        self._send(404, {"success": False, "msg": f"fixture route not found: {method} {parsed.path}", "obj": None})

    def _authorized(self) -> bool:
        auth = self.headers.get("Authorization", "").strip()
        scheme, _, value = auth.partition(" ")
        if not auth:
            self._send(401, {"success": False, "msg": "missing bearer token", "obj": None})
            return False
        if scheme.lower() != "bearer" or value.strip() != Handler.api_token:
            self._send(403, {"success": False, "msg": "invalid bearer token", "obj": None})
            return False
        return True

    def _read_payload(self) -> Any:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        if not raw:
            return {}
        content_type = self.headers.get("Content-Type", "")
        if "application/x-www-form-urlencoded" in content_type:
            parsed = parse_qs(raw, keep_blank_values=True)
            return {
                key: self._coerce_form_value(values[-1] if values else "")
                for key, values in parsed.items()
            }
        try:
            value = json.loads(raw)
        except json.JSONDecodeError:
            return {}
        return value

    @staticmethod
    def _coerce_form_value(value: str) -> Any:
        trimmed = value.strip()
        lowered = trimmed.lower()
        if lowered == "true":
            return True
        if lowered == "false":
            return False
        if trimmed.startswith("{") or trimmed.startswith("["):
            try:
                return json.loads(trimmed)
            except json.JSONDecodeError:
                return value
        return value

    def _ok(self, obj: Any) -> None:
        self._send(200, {"success": True, "msg": "", "obj": obj})

    def _bool_result(self, found: bool) -> None:
        if found:
            self._ok(True)
        else:
            self._send(404, {"success": False, "msg": "not found", "obj": None})

    def _maybe_found(self, obj: Any | None) -> None:
        if obj is None:
            self._send(404, {"success": False, "msg": "not found", "obj": None})
        else:
            self._ok(obj)

    def _send(self, status: int, payload: dict[str, Any]) -> None:
        raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    @staticmethod
    def _int(value: str) -> int:
        try:
            return int(value)
        except ValueError:
            return -1


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a local Xray Runtime API fixture.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=0)
    parser.add_argument("--ready-file", default="")
    parser.add_argument("--api-token", default=os.environ.get("XRAY_RUNTIME_FIXTURE_TOKEN", ""))
    args = parser.parse_args()

    Handler.api_token = args.api_token
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    host, port = server.server_address[:2]

    if args.ready_file:
        pathlib.Path(args.ready_file).write_text(f"{host}:{port}", encoding="utf-8")
    print(f"Xray Runtime fixture listening on http://{host}:{port}", flush=True)

    def stop(_signum: int, _frame: Any) -> None:
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    server.serve_forever()
    return 0


if __name__ == "__main__":
    sys.exit(main())

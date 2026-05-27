package com.admin.common.utils;

public final class LowMemoryPolicyUtils {

    public static final long NANO_MEMORY_MB = 256L;
    public static final long NANO_CRITICAL_MEMORY_MB = 200L;
    public static final long SMALL_MEMORY_MB = 512L;

    private LowMemoryPolicyUtils() {
    }

    public static boolean isLowMemory(Long memoryTotalMb) {
        return memoryTotalMb != null && memoryTotalMb > 0 && memoryTotalMb < NANO_MEMORY_MB;
    }

    public static boolean isNanoCritical(Long memoryTotalMb) {
        return memoryTotalMb != null && memoryTotalMb > 0 && memoryTotalMb < NANO_CRITICAL_MEMORY_MB;
    }

    public static String profile(Long memoryTotalMb) {
        if (memoryTotalMb == null || memoryTotalMb <= 0) {
            return "unknown";
        }
        if (memoryTotalMb < NANO_CRITICAL_MEMORY_MB) {
            return "nano-critical";
        }
        if (memoryTotalMb < NANO_MEMORY_MB) {
            return "nano";
        }
        if (memoryTotalMb < SMALL_MEMORY_MB) {
            return "small";
        }
        return "standard";
    }

    public static String advice(Long memoryTotalMb) {
        if (memoryTotalMb == null || memoryTotalMb <= 0) {
            return null;
        }
        if (memoryTotalMb < NANO_CRITICAL_MEMORY_MB) {
            return "Memory is below 200 MB. Avoid full Xray Panel/Xray orchestration; prefer Snell or port forwarding and enable swap.";
        }
        if (memoryTotalMb < NANO_MEMORY_MB) {
            return "Memory is below 256 MB. Treat this as a Nano node; avoid full Xray Panel/Xray unless swap is available.";
        }
        if (memoryTotalMb < SMALL_MEMORY_MB) {
            return "Memory is below 512 MB. Full Xray Panel/Xray may work only with careful swap and low concurrency.";
        }
        return null;
    }
}

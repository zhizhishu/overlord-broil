


// 获取主控地址列表
export async function getMasterAddresses(callback: string = "setMasterAddresses"){
    if ((window as any).JsInterface && (window as any).JsInterface.getMasterAddresses) {
        (window as any).JsInterface.getMasterAddresses(callback);
    } else if ((window as any).webkit && (window as any).webkit.messageHandlers) {
        (window as any).webkit.messageHandlers.getMasterAddresses.postMessage(callback);
    }

}

// 保存主控地址
export async function saveMasterAddress(name: string, address: string){
    if ((window as any).JsInterface) {
        (window as any).JsInterface.saveMasterAddress(name, address);
    } else if ((window as any).webkit && (window as any).webkit.messageHandlers) {
        (window as any).webkit.messageHandlers.saveMasterAddress.postMessage({ name, address });
    }
}

// 设置当前主控地址
export async function setCurrentMasterAddress(name: string) {
    if ((window as any).JsInterface) {
        (window as any).JsInterface.setCurrentMasterAddress(name);
    } else if ((window as any).webkit && (window as any).webkit.messageHandlers) {
        (window as any).webkit.messageHandlers.setCurrentMasterAddress.postMessage({ name });
    }
}

// 删除主控地址
export async function deleteMasterAddress(name: string){
    if ((window as any).JsInterface) {
        (window as any).JsInterface.deleteMasterAddress(name);
    } else if ((window as any).webkit && (window as any).webkit.messageHandlers) {
        (window as any).webkit.messageHandlers.deleteMasterAddress.postMessage({ name });
    }
}

export function isWebViewFunc(){
  if((window as any).JsInterface !== undefined && (window as any).JsInterface.getMasterAddresses !== undefined) {
    return true;
  }else if((window as any).webkit && (window as any).webkit.messageHandlers && (window as any).webkit.messageHandlers.getMasterAddresses !== undefined) {
    return true;
  }else {
    return false;
  }
}

// 验证主控地址格式
export function validateMasterAddress(address: string): boolean {
  try {
    // 基本格式检查：必须以 http:// 或 https:// 开头
    if (!address.startsWith('http://') && !address.startsWith('https://')) {
      return false;
    }

    // 使用URL构造函数验证完整URL格式
    const url = new URL(address);
    
    // 检查主机名不能为空
    if (!url.hostname || url.hostname.trim() === '') {
      return false;
    }
    
    // 检查主机名
    const hostname = url.hostname;
    
    // 支持 localhost
    if (hostname === 'localhost') {
      return true;
    }
    
    // 支持 IPv4 地址
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Pattern.test(hostname)) {
      const parts = hostname.split('.');
      return parts.every(part => {
        const num = parseInt(part);
        return num >= 0 && num <= 255;
      });
    }
    
    // 支持 IPv6 地址
    const ipv6Pattern = /^\[([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\]$|^\[([0-9a-fA-F]{1,4}:)*:([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}\]$/;
    if (ipv6Pattern.test(hostname)) {
      return true;
    }
    
    // 支持域名
    const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    if (domainPattern.test(hostname)) {
      return true;
    }
    
    return false;
  } catch (error) {
    // URL构造函数失败说明格式不正确
    return false;
  }
}


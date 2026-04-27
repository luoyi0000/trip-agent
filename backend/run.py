"""启动脚本"""

import sys
import os

# 修复 Windows 终端编码问题（GBK 不支持 Emoji，导致 MCPClient 初始化崩溃）
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except AttributeError:
        pass  # Python < 3.7 不支持 reconfigure
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")

import uvicorn
from app.config import get_settings

if __name__ == "__main__":
    settings = get_settings()
    
    uvicorn.run(
        "app.api.main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
        log_level=settings.log_level.lower()
    )


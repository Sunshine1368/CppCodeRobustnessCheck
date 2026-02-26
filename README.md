# C++ 代码检查后端

为液态玻璃风格 C++ 代码检查网站提供后端 API 服务。

## 功能

- 接收 C++ 代码、C++ 标准版本和编译器信息
- 返回代码强壮性评分和问题列表（基于模拟规则）

## API 接口

### `POST /api/analyze`

**请求体 JSON**
```json
{
    "code": "string",          // 必填，C++ 代码
    "version": "c++17",        // 可选，默认 c++17
    "compiler": "gcc"          // 可选，默认 gcc
}
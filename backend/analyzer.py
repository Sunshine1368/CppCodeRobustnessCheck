import re

def analyze_code(code, version, compiler):
    """
    模拟代码强壮性分析（基于简单规则扫描）
    返回 issues 列表和评分
    """
    issues = []
    total_score = 100

    def version_at_least(min_version):
        order = ['c++98', 'c++11', 'c++14', 'c++17', 'c++20', 'c++23']
        return order.index(version) >= order.index(min_version)

    # 规则1: 裸new无delete
    new_count = len(re.findall(r'new\s+\w+', code))
    if new_count > 0:
        delete_count = len(re.findall(r'delete', code))
        if new_count > delete_count and 'shared_ptr' not in code and 'unique_ptr' not in code:
            issues.append({
                'icon': 'fa-regular fa-droplet',
                'text': '内存泄漏风险: 存在 raw new 无对应 delete',
                'severity': 'high'
            })
            total_score -= 18

    # 规则2: vector 频繁 push_back 但未 reserve
    if 'vector<' in code and 'reserve(' not in code and 'push_back' in code:
        issues.append({
            'icon': 'fa-regular fa-clock',
            'text': 'vector 频繁 push_back 但未 reserve, 可能引起多次重分配及异常安全削弱',
            'severity': 'medium'
        })
        total_score -= 8

    # 规则3: using namespace std;
    if 'using namespace std;' in code:
        msg = '使用了 using namespace std; (可能引起命名空间冲突)'
        if compiler == 'msvc':
            msg += '，MSVC 中尤其需要注意全局命名污染'
        issues.append({
            'icon': 'fa-regular fa-circle-exclamation',
            'text': msg,
            'severity': 'low'
        })
        total_score -= 6

    # 规则4: 异常处理检查
    if 'throw' in code and 'catch' not in code:
        issues.append({
            'icon': 'fa-regular fa-bug',
            'text': '存在throw但缺少catch块，异常可能未被妥善处理',
            'severity': 'medium'
        })
        total_score -= 12
    elif 'catch' not in code and ('new ' in code or 'fopen' in code):
        issues.append({
            'icon': 'fa-regular fa-shield',
            'text': '资源分配无异常处理保证，建议使用RAII包装',
            'severity': 'low'
        })
        total_score -= 5

    # 规则5: 迭代器失效风险
    if 'for' in code and 'push_back' in code and 'begin()' in code:
        issues.append({
            'icon': 'fa-regular fa-triangle-exclamation',
            'text': '循环中修改容器可能导致迭代器失效 (需谨慎)',
            'severity': 'medium'
        })
        total_score -= 10

    # 规则6: C风格I/O
    if re.search(r'printf\(|scanf\(', code):
        issues.append({
            'icon': 'fa-regular fa-flag',
            'text': '使用了 C 风格 I/O (建议使用 iostream 增加类型安全)',
            'severity': 'low'
        })
        total_score -= 5

    # 规则7: NULL 而非 nullptr (仅C++11及以上)
    if version_at_least('c++11') and 'NULL' in code and 'nullptr' not in code:
        issues.append({
            'icon': 'fa-regular fa-circle',
            'text': '使用了 NULL 而非 nullptr (C++11 推荐)',
            'severity': 'low'
        })
        total_score -= 3

    # 规则8: 未初始化指针
    if 'int* p;' in code and '= nullptr' not in code and 'new' not in code:
        issues.append({
            'icon': 'fa-regular fa-question',
            'text': '指针未初始化或赋予有效地址',
            'severity': 'high'
        })
        total_score -= 15

    # 规则9: 潜在除零
    if '/' in code and ('x = 0' in code or 'y = 0' in code):
        issues.append({
            'icon': 'fa-regular fa-calculator',
            'text': '存在可能除零的赋值，请检查算术安全',
            'severity': 'medium'
        })
        total_score -= 8

    # 规则10: 编译器特定提示
    if compiler == 'clang' and 'auto' in code:
        issues.append({
            'icon': 'fa-regular fa-star',
            'text': 'Clang 下 auto 类型推导较为温和，但请注意结合 decltype',
            'severity': 'low'
        })
    if compiler == 'msvc' and 'for each' in code:
        issues.append({
            'icon': 'fa-regular fa-warning',
            'text': 'MSVC 的 `for each` 是非标准扩展，建议使用范围 for',
            'severity': 'medium'
        })

    total_score = max(12, min(99, total_score))

    if not issues:
        issues.append({
            'icon': 'fa-regular fa-thumbs-up',
            'text': '代码看起来强健，符合常见最佳实践',
            'severity': 'good'
        })
    else:
        # 按严重程度排序
        severity_order = {'high': 3, 'medium': 2, 'low': 1, 'good': 0}
        issues.sort(key=lambda x: severity_order.get(x['severity'], 0), reverse=True)

    return {'issues': issues, 'score': total_score}
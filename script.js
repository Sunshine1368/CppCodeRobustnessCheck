(function() {
  // 获取DOM元素
  const textarea = document.getElementById('codeInput');
  const issuesList = document.getElementById('issuesList');
  const scoreDisplay = document.getElementById('scoreDisplay');
  const gaugeRing = document.getElementById('gaugeRing');
  const stdBadges = document.querySelectorAll('.std-item');
  const checkBtn = document.getElementById('checkBtn');
  const resetBtn = document.getElementById('resetBtn');
  const runSimBtn = document.getElementById('runSimBtn');
  const simOutput = document.getElementById('simOutput');
  const cppVersionSelect = document.getElementById('cppVersion');
  const compilerSelect = document.getElementById('compiler');
  const darkModeToggle = document.getElementById('darkModeToggle');

  // 初始化CodeMirror
  const editor = CodeMirror.fromTextArea(textarea, {
    lineNumbers: true,
    mode: 'text/x-c++src',
    theme: 'eclipse',
    indentUnit: 4,
    smartIndent: true,
    matchBrackets: true,
    autoCloseBrackets: true,
    viewportMargin: Infinity,
  });
  editor.setSize('auto', '300px');

  // 默认代码
  const DEFAULT_CODE = `#include <iostream>
#include <vector>
using namespace std;

int main() {
    int* p = new int(42);
    vector<int> v;
    v.push_back(10);
    cout << "value: " << *p << endl;
    // 忘记 delete p
    return 0;
}`;

  // ----- 深色模式切换 -----
  function initDarkMode() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      document.body.classList.add('dark-mode');
      updateDarkIcon(true);
    }
  }

  function updateDarkIcon(isDark) {
    const icon = darkModeToggle.querySelector('i');
    if (isDark) {
      icon.className = 'fa-regular fa-moon';
    } else {
      icon.className = 'fa-regular fa-sun';
    }
  }

  darkModeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    updateDarkIcon(isDark);
  });

  // 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (e.matches) {
      document.body.classList.add('dark-mode');
      updateDarkIcon(true);
    } else {
      document.body.classList.remove('dark-mode');
      updateDarkIcon(false);
    }
  });

  initDarkMode();

  // ----- 强壮性分析引擎 (集成版本和编译器) -----
  function analyzeCode(code, version, compiler) {
    const issues = [];
    let totalScore = 100;

    // 辅助函数：如果版本至少为指定版本，返回true (简单字符串比较)
    function versionAtLeast(minVersion) {
      const order = ['c++98', 'c++11', 'c++14', 'c++17', 'c++20', 'c++23'];
      return order.indexOf(version) >= order.indexOf(minVersion);
    }

    // 规则1: 裸new无delete (所有版本)
    if ((code.match(/new\s+\w+/g) || []).length > 0) {
      const deleteCount = (code.match(/delete/g) || []).length;
      const newCount = (code.match(/new\s+[a-zA-Z_]/g) || []).length;
      if (newCount > deleteCount && !code.includes('shared_ptr') && !code.includes('unique_ptr')) {
        issues.push({ icon: 'fa-regular fa-droplet', text: '内存泄漏风险: 存在 raw new 无对应 delete', severity: 'high' });
        totalScore -= 18;
      }
    }

    // 规则2: vector 频繁 push_back 但未 reserve
    if (code.includes('vector<') && !code.includes('reserve(') && code.includes('push_back')) {
      issues.push({ icon: 'fa-regular fa-clock', text: 'vector 频繁 push_back 但未 reserve, 可能引起多次重分配及异常安全削弱', severity: 'medium' });
      totalScore -= 8;
    }

    // 规则3: using namespace std; (编译器特定建议)
    if (code.includes('using namespace std;')) {
      let msg = '使用了 using namespace std; (可能引起命名空间冲突)';
      if (compiler === 'msvc') msg += '，MSVC 中尤其需要注意全局命名污染';
      issues.push({ icon: 'fa-regular fa-circle-exclamation', text: msg, severity: 'low' });
      totalScore -= 6;
    }

    // 规则4: 异常处理检查
    if (code.includes('throw') && !code.includes('catch')) {
      issues.push({ icon: 'fa-regular fa-bug', text: '存在throw但缺少catch块，异常可能未被妥善处理', severity: 'medium' });
      totalScore -= 12;
    } else if (!code.includes('catch') && (code.includes('new ') || code.includes('fopen'))) {
      issues.push({ icon: 'fa-regular fa-shield', text: '资源分配无异常处理保证，建议使用RAII包装', severity: 'low' });
      totalScore -= 5;
    }

    // 规则5: 迭代器失效风险
    if (code.includes('for') && code.includes('push_back') && code.includes('begin()')) {
      issues.push({ icon: 'fa-regular fa-triangle-exclamation', text: '循环中修改容器可能导致迭代器失效 (需谨慎)', severity: 'medium' });
      totalScore -= 10;
    }

    // 规则6: C 风格 I/O
    if (code.match(/printf\(|scanf\(/)) {
      issues.push({ icon: 'fa-regular fa-flag', text: '使用了 C 风格 I/O (建议使用 iostream 增加类型安全)', severity: 'low' });
      totalScore -= 5;
    }

    // 规则7: NULL 而非 nullptr (仅C++11及以上)
    if (versionAtLeast('c++11') && code.includes('NULL') && !code.includes('nullptr')) {
      issues.push({ icon: 'fa-regular fa-circle', text: '使用了 NULL 而非 nullptr (C++11 推荐)', severity: 'low' });
      totalScore -= 3;
    }

    // 规则8: 未初始化指针
    if (code.includes('int* p;') && !code.includes('= nullptr') && !code.includes('new')) {
      issues.push({ icon: 'fa-regular fa-question', text: '指针未初始化或赋予有效地址', severity: 'high' });
      totalScore -= 15;
    }

    // 规则9: 潜在的除零（演示）
    if (code.includes('/') && (code.includes('x = 0') || code.includes('y = 0'))) {
      issues.push({ icon: 'fa-regular fa-calculator', text: '存在可能除零的赋值，请检查算术安全', severity: 'medium' });
      totalScore -= 8;
    }

    // 规则10: 根据编译器添加额外信息
    if (compiler === 'clang' && code.includes('auto')) {
      // 示例：clang 对 auto 推导有更友好的提示
      issues.push({ icon: 'fa-regular fa-star', text: 'Clang 下 auto 类型推导较为温和，但请注意结合 decltype', severity: 'low' });
    }
    if (compiler === 'msvc' && code.includes('for each')) {
      issues.push({ icon: 'fa-regular fa-warning', text: 'MSVC 的 `for each` 是非标准扩展，建议使用范围 for', severity: 'medium' });
    }

    totalScore = Math.max(12, Math.min(99, totalScore));

    if (issues.length === 0) {
      issues.push({ icon: 'fa-regular fa-thumbs-up', text: '代码看起来强健，符合常见最佳实践', severity: 'good' });
    } else {
      issues.sort((a, b) => {
        const w = { high: 3, medium: 2, low: 1, good: 0 };
        return (w[b.severity] || 0) - (w[a.severity] || 0);
      });
    }

    return { issues, score: totalScore };
  }

  // 更新仪表盘
  function updateGauge(score) {
    const angle = (score / 100) * 360;
    gaugeRing.style.background = `conic-gradient(from 120deg, #5aa9d9 0deg ${angle}deg, rgba(255,255,255,0.4) ${angle}deg 360deg)`;
  }

  // 更新标准徽章 (根据选择的版本和代码特征)
  function updateStdBadges(code, selectedVersion) {
    stdBadges.forEach(b => b.classList.remove('active'));

    // 提取版本号数值
    const versionNum = selectedVersion.replace('c++', ''); // "11","14"...
    // 点亮所有小于等于选定版本的徽章
    const order = ['11','14','17','20','23'];
    order.forEach(v => {
      if (parseInt(v) <= parseInt(versionNum)) {
        document.querySelector(`[data-std="c++${v}"]`)?.classList.add('active');
      }
    });

    // 额外根据代码特征点亮可能使用的更高版本特性 (但主要基于选择)
    // (可保留原来的特性检测，但为了简化，我们只基于版本选择)
  }

  // 渲染检查结果
  function renderCheck() {
    const code = editor.getValue();
    const version = cppVersionSelect.value;
    const compiler = compilerSelect.value;
    const { issues, score } = analyzeCode(code, version, compiler);

    scoreDisplay.textContent = score;
    updateGauge(score);

    issuesList.innerHTML = '';
    if (issues.length === 0) {
      issuesList.innerHTML = '<li class="list-placeholder"><i class="fa-regular fa-circle-check" style="color:#1d6f2e;"></i> 未发现明显问题，代码强健</li>';
    } else {
      issues.forEach(issue => {
        const li = document.createElement('li');
        let iconColor = '';
        if (issue.severity === 'high') iconColor = '#b63e32';
        else if (issue.severity === 'medium') iconColor = '#bf8b2c';
        else if (issue.severity === 'low') iconColor = '#2d6180';
        else iconColor = '#1d6f2e';
        li.innerHTML = `<i class="${issue.icon}" style="color: ${iconColor};"></i> <span>${issue.text}</span>`;
        issuesList.appendChild(li);
      });
    }

    updateStdBadges(code, version);
  }

  // 模拟输出
  function simulateOutput(code) {
    let output = '';
    const coutRegex = /cout\s*<<\s*([^;]+);/g;
    let match;
    while ((match = coutRegex.exec(code)) !== null) {
      let expr = match[1];
      const stringMatches = expr.match(/"([^"\\]*(\\.[^"\\]*)*")/g);
      if (stringMatches) {
        stringMatches.forEach(s => {
          let clean = s.substring(1, s.length-1).replace(/\\n/g, '\n').replace(/\\t/g, '\t');
          output += clean;
        });
      }
      if (expr.includes('endl')) {
        output += '\n';
      }
    }

    const printfRegex = /printf\s*\(\s*"([^"\\]*(\\.[^"\\]*)*)"\s*[^)]*\);/g;
    let pMatch;
    while ((pMatch = printfRegex.exec(code)) !== null) {
      let fmt = pMatch[1];
      let clean = fmt.replace(/%[a-zA-Z]/g, '?').replace(/\\n/g, '\n');
      output += clean;
    }

    if (output === '') {
      output = '[模拟输出] 未检测到 cout 或 printf 语句。';
    }
    return output;
  }

  function runSimulation() {
    const code = editor.getValue();
    const simulated = simulateOutput(code);
    simOutput.textContent = simulated || '（无输出）';
  }

  // 重置示例
  function resetToDefault() {
    editor.setValue(DEFAULT_CODE);
    cppVersionSelect.value = 'c++17';
    compilerSelect.value = 'gcc';
    renderCheck();
    runSimulation();
  }

  // 事件绑定
  checkBtn.addEventListener('click', (e) => {
    e.preventDefault();
    renderCheck();
  });

  resetBtn.addEventListener('click', (e) => {
    e.preventDefault();
    resetToDefault();
  });

  runSimBtn.addEventListener('click', (e) => {
    e.preventDefault();
    runSimulation();
  });

  // 版本/编译器变化时重新检查
  cppVersionSelect.addEventListener('change', renderCheck);
  compilerSelect.addEventListener('change', renderCheck);

  // 编辑器内容变化自动检查（防抖）
  let timeoutId;
  editor.on('change', () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      renderCheck();
    }, 500);
  });

  // 初始渲染
  window.addEventListener('load', () => {
    renderCheck();
    runSimulation();
  });
})();
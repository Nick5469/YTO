
const TextProcessor = {
    /**
     * 初始化文本处理器
     * @param {string} text - 要处理的文本
     */
    init(text) {
        this.lines = text.split(/\r?\n/);
        this.text = text;
        return this;
    },

    /**
     * 模糊搜索行（返回所有包含关键词的行号和内容）
     * @param {string} keyword - 搜索关键词
     * @param {boolean} [caseSensitive=false] - 是否区分大小写
     * @return {Array<{lineNumber: number, lineText: string}>} 匹配结果
     */
    searchLines(keyword, caseSensitive = false) {
        if (!keyword) return [];

        const pattern = caseSensitive ? keyword : keyword.toLowerCase();
        const results = [];

        for (let i = 0; i < this.lines.length; i++) {
            const line = this.lines[i];
            const compareText = caseSensitive ? line : line.toLowerCase();

            if (compareText.includes(pattern)) {
                results.push({
                    lineNumber: i + 1, // 行号从1开始
                    lineText: line
                });
            }
        }

        return results;
    },

    /**
     * 获取指定行的文本
     * @param {number} lineNumber - 行号（从1开始）
     * @return {string|null} 行文本（不存在返回null）
     */
    getLine(lineNumber) {
        if (lineNumber < 1 || lineNumber > this.lines.length) {
            return null;
        }
        return this.lines[lineNumber - 1];
    },

    /**
     * 提取两个标记之间的文本
     * @param {string} text - 要处理的文本
     * @param {string} startMarker - 开始标记
     * @param {string} endMarker - 结束标记
     * @param {boolean} [includeMarkers=false] - 是否包含标记本身
     * @return {string[]} 提取到的文本数组
     */
    extractBetween(text, startMarker, endMarker, includeMarkers = false) {
        const results = [];
        let startIndex = 0;

        while (true) {
            const startPos = text.indexOf(startMarker, startIndex);
            if (startPos === -1) break;

            const endPos = text.indexOf(endMarker, startPos + startMarker.length);
            if (endPos === -1) break;

            const extracted = includeMarkers
                ? text.substring(startPos, endPos + endMarker.length)
                : text.substring(startPos + startMarker.length, endPos);

            results.push(extracted);
            startIndex = endPos + endMarker.length;
        }

        return results;
    },

    /**
     * 批量处理所有行，提取中间文本
     * @param {string} startMarker - 开始标记
     * @param {string} endMarker - 结束标记
     * @param {boolean} [includeMarkers=false] - 是否包含标记本身
     * @return {Array<{lineNumber: number, extracted: string[]}>} 每行的提取结果
     */
    batchExtractBetween(startMarker, endMarker, includeMarkers = false) {
        return this.lines.map((line, index) => {
            const extracted = this.extractBetween(line, startMarker, endMarker, includeMarkers);
            return {
                lineNumber: index + 1,
                extracted: extracted
            };
        }).filter(item => item.extracted.length > 0);
    },

    /**
    * 提取分隔符右侧的文本
    * @param {string} text - 原始文本
    * @param {string} separator - 分隔符
    * @param {object} [options] - 配置选项
    * @param {boolean} [options.includeSeparator=false] - 是否包含分隔符本身
    * @param {boolean} [options.lastOccurrence=false] - 是否使用最后一个匹配的分隔符
    * @return {string} 分隔符右侧的文本（未找到返回空字符串）
    */
    extractRight(text, separator, options = {}) {
        if (!text || !separator) return '';

        const {
            includeSeparator = false,
            lastOccurrence = false
        } = options;

        let index = lastOccurrence
            ? text.lastIndexOf(separator)
            : text.indexOf(separator);

        if (index === -1) return '';

        return includeSeparator
            ? text.substring(index)
            : text.substring(index + separator.length);
    },

    /**
    * 综合查询函数
    * @param {string} question - 要搜索的问题关键词
    * @return {Array<{sectionId: string, questionText: string}>} 查询结果数组
    */
    queryQuestion(question) {
        // 1. 搜索包含question的行
        const matchedLines = this.searchLines(question);
        const results = [];

        // 2. 处理每个匹配行
        for (const { lineNumber } of matchedLines) {
            // 3. 获取当前行文本并提取=右边的内容
            const currentLine = this.getLine(lineNumber);
            const questionText = this.extractRight(currentLine, '=').trim();

            // 4. 获取行号-2的行(节名行)
            const sectionLineNumber = lineNumber - 5;
            if (sectionLineNumber < 1) continue; // 确保行号有效

            const sectionLine = this.getLine(sectionLineNumber);
            if (!sectionLine) continue;

            // 5. 提取[]中间的节名
            const sectionIdMatches = this.extractBetween(sectionLine, '[', ']');
            if (sectionIdMatches.length === 0) continue;

            const sectionId = sectionIdMatches[0];

            // 6. 添加到结果
            results.push({
                sectionId: sectionId,
                questionText: questionText
            });
        }

        return results;
    }

};



document.addEventListener('DOMContentLoaded', function () {
    // 获取DOM元素
    const modeToggle = document.getElementById('modeToggle');
    const refreshButton = document.getElementById('refreshButton');
    const deleteButton = document.getElementById('deleteButton');
    const currentTimeElement = document.getElementById('currentTime');
    const parseStatusElement = document.getElementById('parseStatus');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const alertBar = document.getElementById('alertBar');
    const resultTab = document.getElementById('result-tab');
    const closeNoticeButton = document.getElementById('closeNotice');
    const noticeTab = document.getElementById('noticeTab');
    const idInput = document.getElementById('idInput');
    const localQueryButton = document.querySelector('.local-query');
    const onlineQueryButton = document.querySelector('.online-query');
    const getAuthButton = document.getElementById('getAuthButton');

    // 初始检查模式状态
    document.getElementById('importButton').style.display = modeToggle.checked ? 'none' : 'block';

    // 全局变量
    let iniData = null;
    //const INI_URL = 'https://111pan.cn/f/Za6Tw/.YTO_DB.INI';
    const INI_URL = 'https://111pan.cn/f/9Wzfa/test.INI';
    let queryHistory = JSON.parse(localStorage.getItem('queryHistory')) || [];
    let settings = {
        authType: 'cloud',
        questionSource: 'global'
    };
    let cookie = null;

    // 初始化页面
    initTabs();
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    loadLocalStorage();
    loadSettings();

    // 初始化页面时加载设置
    function loadSettings() {
        const savedSettings = localStorage.getItem('appSettings');
        if (savedSettings) {
            settings = JSON.parse(savedSettings);
            document.querySelector(`input[name="authType"][value="${settings.authType}"]`).checked = true;
            document.querySelector(`input[name="questionSource"][value="${settings.questionSource}"]`).checked = true;
        }
    }

    // 从本地存储加载设置
    function loadLocalStorage() {
        if (localStorage.getItem('noticeClosed') === 'true') {
            noticeTab.classList.remove('active');
        }
    }

    // 标签页切换功能
    function initTabs() {
        tabButtons.forEach(button => {
            button.addEventListener('click', function () {
                // 移除所有按钮的active类
                tabButtons.forEach(btn => btn.classList.remove('active'));
                // 给当前按钮添加active类
                this.classList.add('active');

                // 隐藏所有内容
                tabContents.forEach(content => content.classList.remove('active'));
                // 显示对应内容
                const tabId = this.getAttribute('data-tab');
                document.getElementById(tabId).classList.add('active');

                // 确保结果区域保持显示
                resultTab.classList.add('active');
            });
        });
    }

    // 更新时间显示
    function updateCurrentTime() {
        const now = new Date();
        // 格式化为 yyyy/MM/dd hh:mm:ss
        const formattedTime = now.getFullYear() + '/' +
            String(now.getMonth() + 1).padStart(2, '0') + '/' +
            String(now.getDate()).padStart(2, '0') + ' ' +
            String(now.getHours()).padStart(2, '0') + ':' +
            String(now.getMinutes()).padStart(2, '0') + ':' +
            String(now.getSeconds()).padStart(2, '0');

        currentTimeElement.textContent = formattedTime;
    }

    // 更新解析状态
    function updateParseStatus(parsed) {
        parseStatusElement.textContent = parsed ? '题库已解析' : '题库未解析';
        parseStatusElement.classList.toggle('parsed', parsed);
    }

    // 显示提示信息
    function showAlert(message, type = 'info') {
        alertBar.textContent = message;
        alertBar.className = 'alert-bar show ' + type;

        // 3秒后自动隐藏
        setTimeout(() => {
            alertBar.classList.remove('show');
        }, 3000);
    }

    // 修改全局INI_URL为根据配置动态获取
    function getIniUrl() {
        if (settings.questionSource === 'local') {
            return 'https://111pan.cn/f/9Wzfa/test.INI';
        } else {
            return './resource/YTO_DB.INI'; // 全球源
        }
    }

    // 获取COOKIE
    async function fetchCookie (params) {
        showAlert('正在获取账号授权...', 'info');

        try {
            const response = await fetch('https://yto.nickhome.eu.org/resource/cookie');
            if (!response.ok) throw new Error('网络响应失败');
            
            cookie = await response.text();
            showAlert('已获取授权', 'info');
            
            
        }
        catch (error) {
            console.error('获取COOKIE失败 ',error);
            showAlert(`获取授权失败: ${error.message}`, 'error');

        }
        
    }

    // 获取INI数据
    async function fetchINIData() {
        showAlert('正在从服务器获取题库数据...', 'info');
        refreshButton.classList.add('refreshing');
        updateParseStatus(false);

        try {
            //const response = await fetch(INI_URL);
            const response = await fetch(getIniUrl());
            if (!response.ok) throw new Error('网络响应不正常');

            const text = await response.text();
            iniData = parseINI(text);
            updateParseStatus(true);
            //queryTool = Object.create(TextProcessor).init(text);
            showAlert('题库数据已成功加载并解析', 'info');

            // 如果ID输入框有内容，自动查询
            // if (idInput.value.trim()) {
            //     queryById(idInput.value.trim(), true);
            // }
        } catch (error) {
            console.error('获取INI数据失败:', error);
            showAlert(`获取题库数据失败: ${error.message}`, 'error');
        } finally {
            refreshButton.classList.remove('refreshing');
        }
    }

    // 解析INI数据
    function parseINI(text) {
        const result = {};
        let currentSection = null;

        const lines = text.split(/\r?\n/);
        for (const line of lines) {
            const trimmedLine = line.trim();

            if (!trimmedLine || trimmedLine.startsWith(';')) continue;

            const sectionMatch = trimmedLine.match(/^\[(.+)\]$/);
            if (sectionMatch) {
                currentSection = sectionMatch[1];
                result[currentSection] = {};
                continue;
            }

            if (currentSection) {
                const kvMatch = trimmedLine.match(/^(.+?)\s*=\s*(.*)$/);
                if (kvMatch) {
                    const key = kvMatch[1].trim();
                    let value = kvMatch[2].trim();

                    // 转换type值
                    if (key === 'type') {
                        if (value === 'dx') value = '单选题';
                        else if (value === 'dxx') value = '多选题';
                        else if (value === 'pd') value = '判断题';
                    }

                    // 转换level值
                    if (key === 'level') {
                        if (value === 'slow') value = '初级工';
                        else if (value === 'medium') value = '中级工';
                        else if (value === 'high') value = '高级工';
                        else if (value === 'engineer') value = '技师';
                        else if (value === 'hengineer') value = '高级技师';
                    }

                    // 转换answer
                    if (key === 'answer') {
                        if (value === 't') value = '正确'
                        else if (value === 'f') value = '错误'
                    }

                    //option
                    if (key === 'option' & value === '') {
                        value = 'T.正确\nF.错误'
                    }
                    result[currentSection][key] = value;
                }
            }
        }

        return result;
    }

    // 修改后的queryById函数
    function queryById(id, useLocalData) {
        if (!id) {
            showAlert('请输入题目ID', 'warning');
            return;
        }

        // 无论是本地还是在线查询，都使用INI数据
        if (!iniData) {
            showAlert('题库数据未加载，请先刷新数据', 'warning');
            return;
        }

        if (!iniData[id]) {
            showAlert(`未找到ID为 ${id} 的题目`, 'warning');
            clearResult();
            return;
        }

        // 填充数据
        const questionData = iniData[id];
        document.getElementById('result-type').textContent = questionData.type || '未知类型';
        document.getElementById('result-difficulty').textContent = questionData.level || '未知难度';
        document.getElementById('result-id').textContent = id;
        document.getElementById('result-question').textContent = questionData.question || '无题目内容';
        document.getElementById('result-answer').textContent = questionData.answer || '无答案';
        document.getElementById('result-options').textContent = questionData.option.replace(/;/g, '\n') || '无选项';

        // 添加到查询历史
        addToHistory(id, questionData);

        updateHistoryList()
        // 移除empty类
        resultTab.classList.remove('empty');

        showAlert(`已${useLocalData ? '从本地' : '从在线'}找到ID为 ${id} 的题目`, 'info');
        highlightUpdatedFields();
        resultTab.classList.add('active');
    }

    // 添加题目搜索功能
    // 改进的searchByQuestion函数，支持模糊搜索
    function searchByQuestion(question, isOptionSearch = false) {
        if (!iniData) {
            showAlert('题库数据未加载，请先刷新数据', 'warning');
            return;
        }

        const searchTerm = question.trim().toLowerCase();
        if (!searchTerm) {
            showAlert('请输入关键词', 'warning');
            return;
        }
        //console.log(queryTool.queryQuestion(question));
        // 在INI数据中搜索匹配的题目
        const matchedIds = [];
        const searchTerms = searchTerm.split(/\s+/); // 支持多个关键词

        for (const [id, data] of Object.entries(iniData)) {
            const searchText = isOptionSearch
                ? (data.option || '').toLowerCase()
                : (data.question || '').toLowerCase();

            if (searchText) {
                // 检查是否包含所有关键词
                const allKeywordsMatch = searchTerms.every(term =>
                    searchText.includes(term)
                );

                if (allKeywordsMatch) {
                    matchedIds.push({
                        id: id,
                        type: data.type || '未知类型',
                        level: data.level || '未知难度',
                        question: data.question || '无题目内容',
                        answer: data.answer || '无答案',
                        option: data.option || '无选项',
                        // 计算匹配度
                        score: searchTerms.reduce((sum, term) =>
                            sum + (searchText.includes(term) ? 1 : 0), 0)
                    });
                }
            }
        }
        console.log(matchedIds);

        if (matchedIds.length === 0) {
            if (iniData[question]) {
                queryById(question, true);
            }
            else {
                showAlert('未找到匹配的题目', 'warning');
                clearResult();
            }
            return;
        }

        showAlert(`找到${matchedIds.length}个匹配结果`, 'info');

        // 根据匹配度排序
        matchedIds.sort((a, b) => b.score - a.score);

        if (matchedIds.length === 1) {
            displaySingleResult(matchedIds[0]);
        }
        else {
            displayMultipleResults(matchedIds, isOptionSearch);
        }


        // 使用匹配度最高的结果
        // const bestMatch = matchedIds[0];
        // if (matchedIds.length > 1) {
        //     showAlert(`找到${matchedIds.length}个匹配题目，显示最相关结果`, 'info');
        // }

        // // 执行ID查询
        // queryById(bestMatch.id, true);
    }





    // 显示单个结果
    function displaySingleResult(result) {
        document.getElementById('result-type').textContent = result.type || '未知类型';
        document.getElementById('result-difficulty').textContent = result.level || '未知难度';
        document.getElementById('result-id').textContent = result.id;
        document.getElementById('result-question').textContent = result.question || '未知问题';
        document.getElementById('result-answer').textContent = result.answer || '未知答案';
        document.getElementById('result-options').textContent = result.option.replace(/;/g, '\n') || '未知选项';

        // 隐藏多结果列表
        document.getElementById('multiResults').style.display = 'none';
        resultTab.classList.remove('empty');
        highlightUpdatedFields();

        // 添加到查询历史
        addToHistory(result.id, {
            type: result.type,
            question: result.question
        });
    }

    // 显示多个结果
    function displayMultipleResults(results, isOptionSearch) {
        const resultList = document.getElementById('resultList');
        resultList.innerHTML = '';

        // 填充结果列表
        results.forEach(result => {
            const li = document.createElement('li');
            li.innerHTML = `
            <div><strong>ID: ${result.id}</strong> - ${result.type}</div>
            <div class="question-preview">
                ${isOptionSearch ? '选项: ' + result.option.substring(0, 50) : result.question.substring(0, 50)}
                ${(isOptionSearch ? result.option.length : result.question.length) > 50 ? '...' : ''}
            </div>
        `;

            li.addEventListener('click', () => {
                displaySingleResult(result);
            });

            resultList.appendChild(li);
        });

        // 显示多结果列表
        document.getElementById('multiResults').style.display = 'block';
        resultTab.classList.remove('empty');

        //showAlert(`找到${results.length}个匹配结果，请从列表中选择`, 'info');
    }



    // 修改表单提交处理
    document.getElementById('questionForm').addEventListener('submit', function (e) {
        e.preventDefault();
        const question = document.getElementById('questionInput').value;
        searchByQuestion(question, false);
    });

    // 添加选项查询表单处理
    document.getElementById('optionForm').addEventListener('submit', function (e) {
        e.preventDefault();
        const option = document.getElementById('optionInput').value;
        searchByQuestion(option, true); // 选项查询
    });

    // 添加历史记录函数
    function addToHistory(id, data) {
        if (queryHistory.some(item => item.id === id)) return;

        queryHistory.unshift({
            id: id,
            type: data.type || '未知类型',
            question: data.question || '无题目内容',
            time: new Date().toLocaleString()
        });

        if (queryHistory.length > 10) {
            queryHistory.pop();
        }

        localStorage.setItem('queryHistory', JSON.stringify(queryHistory));
        updateHistoryList();
    }

    // 更新历史记录列表
    function updateHistoryList() {
        const historyList = document.getElementById('historyList');
        historyList.innerHTML = '';

        queryHistory.forEach(item => {
            const li = document.createElement('li');
            const isQuestionQuery = item.id.startsWith('search:');

            li.innerHTML = `
            <strong>${isQuestionQuery ? '题目查询' : item.id}</strong> - ${item.type}
            <div class="history-question">${item.question.substring(0, 30)}${item.question.length > 30 ? '...' : ''}</div>
            <small>${item.time}</small>
        `;

            li.addEventListener('click', () => {
                if (isQuestionQuery) {
                    document.getElementById('questionInput').value = item.id.replace('search:', '');
                    document.querySelector('[data-tab="question-tab"]').click();
                    searchByQuestion(item.id.replace('search:', ''));
                } else {
                    idInput.value = item.id;
                    queryById(item.id, true);
                }
            });

            historyList.appendChild(li);
        });
    }

    // 修改clearResult函数
    function clearResult() {
        document.getElementById('result-type').textContent = '-';
        document.getElementById('result-difficulty').textContent = '-';
        document.getElementById('result-id').textContent = '-';
        document.getElementById('result-question').textContent = '-';
        document.getElementById('result-answer').textContent = '-';
        document.getElementById('result-options').textContent = '-';
        document.getElementById('multiResults').style.display = 'none';

        // 添加empty类显示提示
        //resultTab.classList.add('empty');
    }


    // 高亮显示更新字段
    function highlightUpdatedFields() {
        const highlights = document.querySelectorAll('.highlight');
        highlights.forEach(el => {
            el.classList.add('pulse-effect');
            setTimeout(() => {
                el.classList.remove('pulse-effect');
            }, 1000);
        });

        // 特别强调答案字段
        const answer = document.getElementById('result-answer');
        answer.classList.add('answer-highlight');
        setTimeout(() => {
            answer.classList.remove('answer-highlight');
        }, 1500);
    }

    // 表单提交处理
    const forms = document.querySelectorAll('.search-form');
    forms.forEach(form => {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            const query = input.value.trim();
            if (!query) {
                showAlert('请输入搜索内容', 'warning');
            }
        });
    });


    // 关闭公告栏
    closeNoticeButton.addEventListener('click', function () {
        noticeTab.classList.remove('active');
        localStorage.setItem('noticeClosed', 'true');
    });

    // 模式切换功能
    modeToggle.addEventListener('change', function () {
        const isOnline = this.checked;
        showAlert(`已切换到${isOnline ? '在线' : '本地'}模式`, 'info');

        // 如果切换到在线模式，自动获取INI数据
        if (isOnline) {
            fetchINIData();
        }
    });

    // 刷新按钮功能
    refreshButton.addEventListener('click', function () {
        if (modeToggle.checked) {
            fetchINIData();
        } else {
            // 本地刷新
            this.classList.add('refreshing');
            showAlert('正在从本地刷新数据...', 'info');

            setTimeout(() => {
                this.classList.remove('refreshing');
                showAlert('数据已从本地更新', 'info');

                // 如果ID输入框有内容，重新查询
                if (idInput.value.trim()) {
                    queryById(idInput.value.trim(), false);
                }
            }, 800);
        }
    });

    //清除记录
    deleteButton.addEventListener('click', function () {
        localStorage.clear();
        window.location.reload();
    });

    // 修改按钮事件处理
    localQueryButton.addEventListener('click', function () {
        queryById(idInput.value.trim(), true);
    });

    onlineQueryButton.addEventListener('click', async function () {

        if (!cookie) {
            showAlert('未获取账号授权', 'warning');
            return;
        }
        console.log(cookie);
        document.cookie = cookie;
        try {
            const response = await fetch('http://ytosclb.com/index.php?m=home&c=break&a=checkanswer',{
                method: 'POST',
                headers: {
                'Cookie': cookie
            },
                body: 'exam_id=217037&answer=f',
                credentials: 'include'

            });

            if (!response.ok) throw new Error('失败');

            console.log(response.json());
            
        }
        catch (error){
            showAlert(`失败: ${error.message}`,'error');
        }
    })



    // 保存设置
    document.getElementById('saveSettings').addEventListener('click', function () {
        settings.authType = document.querySelector('input[name="authType"]:checked').value;
        settings.questionSource = document.querySelector('input[name="questionSource"]:checked').value;

        localStorage.setItem('appSettings', JSON.stringify(settings));
        showAlert('设置已保存', 'info');
    });

    // 导入题库功能
    document.getElementById('importButton').addEventListener('click', function () {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.ini,.txt';

        fileInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    iniData = parseINI(e.target.result);
                    updateParseStatus(true);
                    showAlert('题库导入成功', 'info');
                } catch (error) {
                    console.error('题库解析失败:', error);
                    showAlert('题库解析失败: ' + error.message, 'warning');
                }
            };
            reader.readAsText(file);
        });

        fileInput.click();
    });

    // 监听模式切换，控制导入按钮显示
    modeToggle.addEventListener('change', function () {
        const isLocalMode = !this.checked;
        document.getElementById('importButton').style.display = isLocalMode ? 'block' : 'none';
    });

    //获取授权
    getAuthButton.addEventListener('click',function () {
        fetchCookie();
    })









    // 初始化时显示欢迎信息
    setTimeout(() => {
        //showAlert('题库查询系统已就绪，请开始查询', 'info');
        // 确保结果区域初始可见
        resultTab.classList.add('active');
        updateHistoryList()
    }, 500);
});
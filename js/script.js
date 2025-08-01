document.addEventListener('DOMContentLoaded', function () {
    // 获取DOM元素
    const modeToggle = document.getElementById('modeToggle');
    const refreshButton = document.getElementById('refreshButton');
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
    resultTab.classList.add('empty');

    // 初始化摄像头标签
    // const cameraTabButton = document.createElement('button');
    // cameraTabButton.className = 'tab-button';
    // cameraTabButton.setAttribute('data-tab', 'camera-tab');
    // cameraTabButton.textContent = '拍照识别1';
    // document.querySelector('.search-tabs').appendChild(cameraTabButton);

    // // 添加点击事件
    // cameraTabButton.addEventListener('click', function() {
    //     tabButtons.forEach(btn => btn.classList.remove('active'));
    //     this.classList.add('active');

    //     tabContents.forEach(content => content.classList.remove('active'));
    //     document.getElementById('camera-tab').classList.add('active');
    //     resultTab.classList.add('active');
    // });


    // 全局变量
    let iniData = null;
    const INI_URL = 'https://111pan.cn/f/Za6Tw/.YTO_DB.INI';
    // let queryHistory = [];
    let queryHistory = JSON.parse(localStorage.getItem('queryHistory')) || [];
    let currentStream = null;
    let usingFrontCamera = false;

    // 初始化页面
    initTabs();
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    loadLocalStorage();

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

    // 关闭公告栏
    closeNoticeButton.addEventListener('click', function () {
        noticeTab.classList.remove('active');
        localStorage.setItem('noticeClosed', 'true');
    });

    // 更新时间显示
    function updateCurrentTime() {
        const now = new Date();
        const formattedTime = now.toISOString().replace('T', ' ').replace(/\..+/, '');
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

    // 模式切换功能
    modeToggle.addEventListener('change', function () {
        const isOnline = this.checked;
        showAlert(`已切换到${isOnline ? '在线' : '本地'}模式`, 'info');

        // 如果切换到在线模式，自动获取INI数据
        if (isOnline) {
            fetchINIData();
        }
    });

    // 获取INI数据
    async function fetchINIData() {
        showAlert('正在从服务器获取题库数据...', 'info');
        refreshButton.classList.add('refreshing');
        updateParseStatus(false);

        try {
            const response = await fetch(INI_URL);
            if (!response.ok) throw new Error('网络响应不正常');

            const text = await response.text();
            iniData = parseINI(text);
            updateParseStatus(true);
            showAlert('题库数据已成功加载并解析', 'info');

            // 如果ID输入框有内容，自动查询
            if (idInput.value.trim()) {
                queryById(idInput.value.trim(), true);
            }
        } catch (error) {
            console.error('获取INI数据失败:', error);
            showAlert(`获取题库数据失败: ${error.message}`, 'error');
        } finally {
            refreshButton.classList.remove('refreshing');
        }
    }

    // 解析INI数据
    // 修改后的parseINI函数，添加type和level转换
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
        document.getElementById('result-options').textContent = questionData.options || '无选项';

        // 添加到查询历史
        addToHistory(id, questionData);

        updateHistoryList()
        // 移除empty类
        resultTab.classList.remove('empty');

        showAlert(`已${useLocalData ? '从本地' : '从在线'}找到ID为 ${id} 的题目`, 'info');
        highlightUpdatedFields();
        resultTab.classList.add('active');
    }

    // 添加清除历史记录功能
    document.getElementById('clearHistory').addEventListener('click', function () {
        queryHistory = [];
        localStorage.setItem('queryHistory', JSON.stringify(queryHistory));
        updateHistoryList();
        showAlert('已清除所有查询记录', 'info');
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
            li.innerHTML = `
            <strong>${item.id}</strong> - ${item.type}
            <div class="history-question">${item.question.substring(0, 30)}${item.question.length > 30 ? '...' : ''}</div>
            <small>${item.time}</small>
        `;

            li.addEventListener('click', () => {
                idInput.value = item.id;
                queryById(item.id, true);
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

        // 添加empty类显示提示
        resultTab.classList.add('empty');
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

    // 修改按钮事件处理
    localQueryButton.addEventListener('click', function () {
        queryById(idInput.value.trim(), true);
    });

    onlineQueryButton.addEventListener('click', function () {
        // 移除在线模式检查
        if (!iniData) {
            showAlert('正在获取题库数据，请稍后...', 'info');
            fetchINIData().then(() => {
                queryById(idInput.value.trim(), false);
            });
        } else {
            queryById(idInput.value.trim(), false);
        }
    })


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

    // 表单提交处理
    const forms = document.querySelectorAll('.search-form');
    forms.forEach(form => {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            const input = this.querySelector('input');
            const query = input.value.trim();

            if (query) {
                const tabId = this.closest('.tab-content').id;
                const isOnline = modeToggle.checked;

                if (tabId === 'id-tab') {
                    queryById(query, isOnline);
                } else {
                    showAlert(`正在${isOnline ? '从服务器' : '从本地'}查询: ${query}`, 'info');
                    refreshButton.classList.add('refreshing');

                    // 模拟查询延迟
                    setTimeout(() => {
                        refreshButton.classList.remove('refreshing');
                        showAlert(`找到${Math.floor(1 + Math.random() * 5)}条匹配结果`, 'info');
                    }, 800);
                }
            } else {
                showAlert('请输入搜索内容', 'warning');
            }
        });
    });




    // 摄像头功能
    document.getElementById('takePhoto').addEventListener('click', async function () {
        const video = document.getElementById('cameraPreview');
        const canvas = document.getElementById('photoCanvas');
        const photoButton = document.getElementById('takePhoto');

        if (photoButton.textContent === '拍照') {
            // 拍照
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

            // 显示照片，隐藏视频
            video.style.display = 'none';
            canvas.style.display = 'block';
            photoButton.textContent = '重新拍摄';

            // 停止摄像头
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
            }

            // 这里可以添加OCR识别代码
            showAlert('照片已拍摄，可以添加OCR识别功能', 'info');
        } else {
            // 重新拍摄
            canvas.style.display = 'none';
            video.style.display = 'block';
            photoButton.textContent = '拍照';
            await startCamera();
        }
    });

    // 切换摄像头
    document.getElementById('toggleCamera').addEventListener('click', async function () {
        usingFrontCamera = !usingFrontCamera;
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        await startCamera();
    });

    // 启动摄像头
    async function startCamera() {
        try {
            const video = document.getElementById('cameraPreview');
            const constraints = {
                video: {
                    facingMode: usingFrontCamera ? 'user' : 'environment'
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints)
                .catch(err => {
                    if (err.name === 'NotAllowedError') {
                        showAlert('摄像头访问被拒绝，请检查权限设置', 'error');
                    }
                    throw err;
                });

            video.srcObject = stream;
            currentStream = stream;
        } catch (err) {
            console.error('摄像头错误:', err);
            showAlert('无法访问摄像头: ' + err.message, 'error');
        }
    }

    // 在标签切换时处理摄像头
    // 改进的标签切换处理
    tabButtons.forEach(button => {
        button.addEventListener('click', function () {
            const tabId = this.getAttribute('data-tab');

            // 关闭当前摄像头（如果正在使用）
            if (currentStream && tabId !== 'camera-tab') {
                currentStream.getTracks().forEach(track => track.stop());
                currentStream = null;
            }

            // 标准标签切换逻辑
            tabButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');

            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            resultTab.classList.add('active');

            // 如果是摄像头标签，启动摄像头
            if (tabId === 'camera-tab') {
                startCamera();
            }
        });
    });




    // 初始化时显示欢迎信息
    setTimeout(() => {
        //showAlert('题库查询系统已就绪，请开始查询', 'info');
        // 确保结果区域初始可见
        resultTab.classList.add('active');
        updateHistoryList()
    }, 500);
});
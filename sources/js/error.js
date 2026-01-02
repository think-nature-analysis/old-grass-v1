// エラーハンドリング関連の機能

const ErrorHandler = {
    // ユーザー向けエラー表示
    showUserError: function (message) {
        // 既存のエラーメッセージを削除
        const existingError = document.getElementById('error-message');
        if (existingError) {
            existingError.remove();
        }

        // エラーメッセージ要素を作成
        const errorElement = document.createElement('div');
        errorElement.id = 'error-message';
        errorElement.className = 'error-message';
        errorElement.textContent = message;

        // 閉じるボタン
        const closeButton = document.createElement('span');
        closeButton.textContent = '×';
        closeButton.style.marginLeft = '10px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.fontWeight = 'bold';
        closeButton.addEventListener('click', () => errorElement.remove());

        errorElement.appendChild(closeButton);
        document.body.appendChild(errorElement);

        // 一定時間後に自動的に消える
        setTimeout(() => {
            if (document.body.contains(errorElement)) {
                errorElement.remove();
            }
        }, AppConstants.vector.errorDisplayDuration);

        // コンソールにも出力
        console.error(message);
    },

    // 開発者向けエラーログ
    logError: function (message, error = null) {
        if (error) {
            console.error(message, error);
        } else {
            console.error(message);
        }
    },
};

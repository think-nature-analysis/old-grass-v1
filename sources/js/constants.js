// アプリケーション定数
// 変更が必要な設定は project_config.yaml に記述してください

const AppConstants = {
    // ファイルパス
    urls: {
        projectConfig: '../project_config.yaml',
        layersConfig: '../data_list.json',
    },

    // レイヤー関連
    layers: {
        defaultLayerId: '__default__',
        maxSelectable: 2,
    },

    // カラーマップの選択肢
    colorMaps: [
        'Spectral',
        'gnuplot2',
        'RdYlGn',
        'RdYlBu',
        'viridis',
        'jet',
        'ocean',
        'nipy_spectral',
        'terrain',
        'binary',
        'Reds',
        'Blues',
        'Greens',
        'RdBu',
        'PRGn',
    ],

    // マーカー関連
    marker: {
        locationPrefix: {
            ODN: 'odn_',
            SPEC: 'spec',
        },
        pointDetectionRadius: 100, // ポイントフィーチャー検出距離（メートル）
    },

    // ベクター関連
    vector: {
        featureSampleSize: 20,      // プロパティ型判定のサンプル数
        maxPresetCategories: 12,    // プリセットパレット使用の上限カテゴリ数
        errorDisplayDuration: 5000, // エラーメッセージ表示時間（ミリ秒）

        // 凡例の表示スタイル
        legendStyle: {
            spacing: 10,            // 凡例間のスペース（px）
            padding: 10,            // 凡例の内側余白（px）
            zIndex: 1000,           // 凡例のz-index
            numericWidth: 220,      // 数値カラーバーの幅（px）
            categoricalWidth: 250,  // カテゴリ凡例の幅（px）
            maxHeight: 300,         // カテゴリ凡例の最大高さ（px）
            infoPanelMargin: 20,    // 情報パネルとのマージン（px）
        },
    },

    // パネル関連
    panel: {
        contentLoadTimeout: 5000, // コンテンツ読み込みタイムアウト（ミリ秒）
    },

    // 検索関連
    search: {
        defaultZoom: 12, // 検索結果表示時のズームレベル
    },
};


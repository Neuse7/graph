const scanButton = document.getElementById('scanButton');
const disconnectButton = document.getElementById('disconnectButton');
const sendButton = document.getElementById('sendButton');
const fastRateButton = document.getElementById('fastRateButton');
const slowRateButton = document.getElementById('slowRateButton');
const demoRateButton = document.getElementById('demoRateButton');
const messageDiv = document.getElementById('messageDiv');
const value1 = document.getElementById('value1');
const value2 = document.getElementById('value2');
const value3 = document.getElementById('value3');
const value4 = document.getElementById('value4');
const value5 = document.getElementById('value5');
const value6 = document.getElementById('value6');
const UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'; // Nordic UART Service UUID
const UART_RX_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // RX Characteristic UUID
const UART_TX_CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // TX Characteristic UUID
const graph = document.getElementById('graph');

let device, server, uartService, txCharacteristic, rxCharacteristic;

function displayMessage(message) {
    messageDiv.textContent = message;
}

// 数値入力が変更されたときにグラフを更新
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', drawCuboid);
});

function drawCuboid() {
    // 入力値を取得
    var a = parseFloat(document.getElementById('value1').value);
    var b = parseFloat(document.getElementById('value2').value);
    var c = parseFloat(document.getElementById('value3').value);
    var x = parseFloat(document.getElementById('value4').value);
    var y = parseFloat(document.getElementById('value5').value);
    var z = parseFloat(document.getElementById('value6').value);

    // 直方体の各頂点の座標を計算
    var vertices = [
        [a - x, b - y, c - z], [a + x, b - y, c - z],
        [a + x, b + y, c - z], [a - x, b + y, c - z],
        [a - x, b - y, c + z], [a + x, b - y, c + z],
        [a + x, b + y, c + z], [a - x, b + y, c + z]
    ];

    // 直方体の辺を構成する点を結ぶためのラインセグメント
    var edges = [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7]
    ];

    // 座標軸に対応する x, y, z の値を分けて配列に格納
    var x_vals = [], y_vals = [], z_vals = [];
    for (var i = 0; i < vertices.length; i++) {
        x_vals.push(vertices[i][0]);
        y_vals.push(vertices[i][1]);
        z_vals.push(vertices[i][2]);
    }

    // 原点を大きな点で表示
    var origin = {
        type: 'scatter3d',
        mode: 'markers',
        x: [0],
        y: [0],
        z: [0],
        marker: {
            size: 10,  // 原点のサイズを大きく
            color: 'rgb(0, 0, 0)',  // 黒色
            symbol: 'circle'
        }
    };

    // グラフのレイアウト設定
    var layout = {
        scene: {
            xaxis: {title: 'X'},
            yaxis: {title: 'Y'},
            zaxis: {title: 'Z'}
        },
        margin: { l: 0, r: 0, b: 0, t: 40 }  // グラフの余白を調整
    };

    // エッジを結ぶためのラインを描画
    var edge_x = [], edge_y = [], edge_z = [];
    for (var i = 0; i < edges.length; i++) {
        var start = edges[i][0];
        var end = edges[i][1];
        edge_x.push(vertices[start][0], vertices[end][0], null);
        edge_y.push(vertices[start][1], vertices[end][1], null);
        edge_z.push(vertices[start][2], vertices[end][2], null);
    }

    // エッジのデータを追加
    var data = [{
        type: 'scatter3d',
        mode: 'lines',
        x: edge_x,
        y: edge_y,
        z: edge_z,
        line: {
            color: 'rgb(255, 0, 0)',
            width: 3
        }
    }, origin];

    // グラフを描画
    Plotly.newPlot('graph', data, layout);
}

function getCurrentTimeString() {
    // 現在の時刻を取得
    const now = new Date();
    const year    = now.getFullYear() % 100; // 西暦（年）
    const month   = now.getMonth() + 1;      // 月（0-11なので+1する）
    const day     = now.getDate();           // 日（1-31）
    const hours   = now.getHours();          // 時間 (0-23)
    const minutes = now.getMinutes();        // 分 (0-59)
    const seconds = now.getSeconds();        // 秒 (0-59)

    // 時、分、秒をバイト列に格納
    const data = new Uint8Array(8);  // 3つの要素（時、分、秒）
    data[0] = 0x03;
    data[1] = seconds + Math.floor(seconds / 10) * 6;
    data[2] = minutes + Math.floor(minutes / 10) * 6;
    data[3] = hours + Math.floor(hours / 10) * 6;
    data[4] = 0;
    data[5] = day + Math.floor(day / 10) * 6;
    data[6] = month + Math.floor(month / 10) * 6;
    data[7] = year + Math.floor(year / 10) * 6;

    // BLEデバイスにデータを送信
    rxCharacteristic.writeValue(data);

    // 時刻を文字列で返す
    const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    return timeString;
}

scanButton.addEventListener('click', async () => {
    try {
        const options = {
            filters: [{ services: [UART_SERVICE_UUID] }],
            optionalServices: [UART_SERVICE_UUID]
        };
        const device = await navigator.bluetooth.requestDevice(options);
        await connectToDevice(device);
    } catch (error) {
        console.error('Error during scan:', error);
        displayMessage('エラー: デバイスが見つかりませんでした');
    }
});

async function connectToDevice(selectedDevice) {
    try {
        device = selectedDevice;
        displayMessage('接続中...');

        server = await device.gatt.connect();
        uartService = await server.getPrimaryService(UART_SERVICE_UUID);
        txCharacteristic = await uartService.getCharacteristic(UART_TX_CHARACTERISTIC_UUID);
        rxCharacteristic = await uartService.getCharacteristic(UART_RX_CHARACTERISTIC_UUID);

        // Set up notifications for incoming data
        txCharacteristic.addEventListener('characteristicvaluechanged', handleDataReceived);
        await txCharacteristic.startNotifications();

        sendButton.disabled = false;
        fastRateButton.disabled = false; // Enable Fast Rate button
        slowRateButton.disabled = false; // Enable Slow Rate button
        demoRateButton.disabled = false; // Enable Slow Rate button
        disconnectButton.disabled = false;
        displayMessage('接続完了');
    } catch (error) {
        console.error('Error during connection:', error);
        displayMessage('エラー: デバイスと接続できませんでした');
    }
}

disconnectButton.addEventListener('click', async () => {
    try {
        if (server) {
            await server.disconnect();
            server = null;
            uartService = null;
            txCharacteristic = null;
            rxCharacteristic = null;

            disconnectButton.disabled = true;
            sendButton.disabled = true;
            fastRateButton.disabled = true; // Disable Fast Rate button
            slowRateButton.disabled = true; // Disable Slow Rate button
            demoRateButton.disabled = true; // Disable Slow Rate button
            displayMessage('デバイスが切断されました');
        }
    } catch (error) {
        console.error('Error during disconnection:', error);
        displayMessage('エラー: デバイスを切断できませんでした');
    }
});

sendButton.addEventListener('click', async () => {
    try {
        if (!rxCharacteristic) {
            displayMessage('エラー: デバイスと接続できませんでした');
            return;
        }

        const num1 = parseInt(value1.value, 10) || 0;
        const num2 = parseInt(value2.value, 10) || 0;
        const num3 = parseInt(value3.value, 10) || 0;
        const num4 = parseInt(value4.value, 10) || 0;
        const num5 = parseInt(value5.value, 10) || 0;
        const num6 = parseInt(value6.value, 10) || 0;
				
        if (num1 < -32768 || num1 > 32767 || num2 < -32768 || num2 > 32767 || num3 < -32768 || num3 > 32767 || num4 < 0 || num4 > 65535 || num5 < 0 || num5 > 65535 || num6 < 0 || num6 > 65535) {
            displayMessage('エラー: 入力不可の値が含まれています');
            return;
        }

        const data = new Uint8Array(13); // 1バイトのアドレス + 6バイトのデータ
        data[0] = 0x01; // アドレスとして使用する1バイト
        data[1] = num1 & 0xFF;
        data[2] = (num1 >> 8) & 0xFF;
        data[3] = num2 & 0xFF;
        data[4] = (num2 >> 8) & 0xFF;
        data[5] = num3 & 0xFF;
        data[6] = (num3 >> 8) & 0xFF;
        data[7] = num4 & 0xFF;
        data[8] = (num4 >> 8) & 0xFF;
        data[9] = num5 & 0xFF;
        data[10] = (num5 >> 8) & 0xFF;
        data[11] = num6 & 0xFF;
        data[12] = (num6 >> 8) & 0xFF;
				
        await rxCharacteristic.writeValue(data);

        // Get current time
        const timeString = getCurrentTimeString();
        displayMessage(`データ送信完了( ${timeString} )`);
    } catch (error) {
        console.error('Error during data send:', error);
        displayMessage('エラー: データ送信に失敗しました');
    }
});

// Fast Rate button event listener
fastRateButton.addEventListener('click', async () => {
    try {
        if (!rxCharacteristic) {
            displayMessage('エラー: デバイスと接続できませんでした');
            return;
        }

        const fastRateData = new Uint8Array(7); // 1バイトのアドレス + 2バイトのデータ
        fastRateData[0] = 0x02; // アドレス
        fastRateData[1] = 6 & 0xFF;
        fastRateData[2] = (6 >> 8) & 0xFF;
        fastRateData[3] = 60 & 0xFF;
        fastRateData[4] = (60 >> 8) & 0xFF;
        fastRateData[5] = 4 & 0xFF;
        fastRateData[6] = (4 >> 8) & 0xFF;

        await rxCharacteristic.writeValue(fastRateData);
        const timeString = getCurrentTimeString();
        displayMessage(`Fast Rate 送信完了( ${timeString} )`);
    } catch (error) {
        console.error('Error during fast rate send:', error);
        displayMessage('エラー: Fast Rate送信に失敗しました');
    }
});

// Slow Rate button event listener
slowRateButton.addEventListener('click', async () => {
    try {
        if (!rxCharacteristic) {
            displayMessage('エラー: デバイスと接続できませんでした');
            return;
        }

        const slowRateData = new Uint8Array(7); // 1バイトのアドレス + 2バイトのデータ
        slowRateData[0] = 0x02; // アドレス
        slowRateData[1] = 10 & 0xFF;
        slowRateData[2] = (10 >> 8) & 0xFF;
        slowRateData[3] = 100 & 0xFF;
        slowRateData[4] = (100 >> 8) & 0xFF;
        slowRateData[5] = 0 & 0xFF;
        slowRateData[6] = (0 >> 8) & 0xFF;

        await rxCharacteristic.writeValue(slowRateData);
        const timeString = getCurrentTimeString();
        displayMessage(`Slow Rate 送信完了( ${timeString} )`);
    } catch (error) {
        console.error('Error during slow rate send:', error);
        displayMessage('エラー: Slow Rate送信に失敗しました');
    }
});

// Demo Rate button event listener
demoRateButton.addEventListener('click', async () => {
    try {
        if (!rxCharacteristic) {
            displayMessage('エラー: デバイスと接続できませんでした');
            return;
        }

        const demoRateData = new Uint8Array(7); // 1バイトのアドレス + 2バイトのデータ
        demoRateData[0] = 0x02; // アドレス
        demoRateData[1] = 25 & 0xFF;
        demoRateData[2] = (25 >> 8) & 0xFF;
        demoRateData[3] = 200 & 0xFF;
        demoRateData[4] = (200 >> 8) & 0xFF;
        demoRateData[5] = 3 & 0xFF;
        demoRateData[6] = (3 >> 8) & 0xFF;

        await rxCharacteristic.writeValue(demoRateData);
        const timeString = getCurrentTimeString();
        displayMessage(`Demo Rate 送信完了( ${timeString} )`);
    } catch (error) {
        console.error('Error during demo rate send:', error);
        displayMessage('エラー: Demo Rate送信に失敗しました');
    }
});
		
function handleDataReceived(event) {
    // Handle received data if needed
}

function preventNegativeInput(event) {
    if (event.target.value < 0) {
        event.target.value = 0;
    }
}
		
// 初期表示で直方体を描画
drawCuboid();
		
value1.addEventListener('input', preventNegativeInput);
value2.addEventListener('input', preventNegativeInput);
value3.addEventListener('input', preventNegativeInput);
value4.addEventListener('input', preventNegativeInput);
value5.addEventListener('input', preventNegativeInput);
value6.addEventListener('input', preventNegativeInput);

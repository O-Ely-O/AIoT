class Pinlogin {
    constructor ({el, loginEndpoint, maxDataCount, maxNumbers = Infinity}) {
        this.el = {
            main: el,
            numPad: el.querySelector(".dlg-footer"),
            textDisplay: el.querySelector(".pin-login__text")
        };
        this.maxNumbers = maxNumbers;
        this.maxDataCount = maxDataCount;
        this.loginEndpoint = loginEndpoint;
        this.mqttClient = "";
        this.chart = [];
        this.batt = [];
        this.topicData = "";
        this.labelData = "";
        this.payloadData = "";
        this.key = "";
        this.value = "";
        

        this._generatePad();
        this._mqttConnect();
        this._initCharts();
        this._mqttMessage();

        //Initialize buttons
        this.sidebarBtn();
        this.bypassBtn();
        this.switchBtn();
    }
    
    
    _mqttConnect() {
        this.mqttClient = mqtt.connect('wss://mqtt.flespi.io',{
            will: {
                topic: 'hello',
                payload: '100',
                qos: 0,
                retain: true,
                properties: {
                    willDelayInterval: 120 /* MQTT 5.0 property saying how many seconds to wait before publishing the LWT message */
                }
            },
            protocolVersion: 5,
            username: '<YOUR-FLESPI-TOKEN>'
        });
        this.mqttClient.on("connect", () => {
            this.mqttClient.subscribe(["temperature", "switch", "relay", "batt", "power-consumption", "water-consumption", "weather-api"], (err) => {
                if (!err) {
                    console.log("Connected Successfully");
                }
                else {
                    console.log("Connection Failed");
                }
            });
            
        });
    }

    _mqttMessage() {
        this.mqttClient.on("message", (topic, payload, packet) => {
            // Message Buffer
            const UnixTimestamp = packet.properties.userProperties.timestamp; // start with a Unix timestamp
            const myDate = new Date(UnixTimestamp * 1000).toLocaleString({hour12:false}).split(" "); // convert timestamp to milliseconds and construct Date object
            var time = myDate[1];
            var mdy = myDate[0];
        
            mdy = mdy.split('/');
            const month = parseInt(mdy[0]);
            const day = parseInt(mdy[1]);
            const year = parseInt(mdy[2]);
            this.labelData = `${month}/${day}`;
            this.topicData = topic;
            this.payloadData = payload.toString();
            
            // console.log(`Message: ${this.payloadData}, QoS: ${packet.qos}`);

            // Functions to distribute message coming from mqtt
            switch (this.topicData.toString()) {
                case "power-consumption":
                    // console.log(this.chart["power-consumption"]);
                    this.addChartData(this.topicData.toString(),this.labelData,this.payloadData);
                    if(this.chart[this.topicData.toString()].data.labels.length > this.maxDataCount) {
                        this.removeChartFirstData(this.topicData.toString());
                    }
                    break;

                case "water-consumption":
                    this.addChartData(this.topicData.toString(),this.labelData,this.payloadData);
                    if(this.chart[this.topicData.toString()].data.labels.length > this.maxDataCount) {
                        this.removeChartFirstData(this.topicData.toString());
                    }
                    break;

                case "weather-api":
                    this.addChartData(this.topicData.toString(),this.labelData,this.payloadData);
                    if(this.chart[this.topicData.toString()].data.labels.length > this.maxDataCount) {
                        this.removeChartFirstData(this.topicData.toString());
                    }
                    break;

                case "batt":
                    const batteryPercentage = document.getElementById("batt-ptg");
                    
                    let firstData = parseInt(batteryPercentage.innerHTML);
                    const data = {variable: firstData,};
                    
                    this.watchSolarData(data, 'variable', (newValue, oldValue) => {
                        console.log(`Variable changed from ${oldValue} to ${newValue}`);
                        batteryPercentage.innerHTML = `${newValue}%`;
                    });
                    data.variable = parseInt(this.payloadData);
                    break;

                case "temperature":
                    this.watchGaugeData("gauge-1", this.payloadData);
            }
        })
    }


    mqttPublish() {
        this.mqttClient.publish("water-consumption", "50");
    }
    
    _generatePad() {
        const padLayout = [
            "1", "2", "3",
            "4", "5", "6",
            "7", "8", "9",
            "backspace", "0", "done"
        ];
        padLayout.forEach(key => {
            const insertBreak = key.search(/[369]/) !== -1;
            const keyEl = document.createElement("div");

            keyEl.classList.add("pin-key")
            keyEl.classList.toggle("material-icons-outlined", isNaN(key));
            keyEl.textContent = key;
            keyEl.addEventListener("click", () => {this._handleKeyPress(key) });
            this.el.numPad.appendChild(keyEl);

            if (insertBreak) {
                this.el.numPad.appendChild(document.createElement("br"));
            }
        });
    }
    
    _handleKeyPress(key) {
        switch (key) {
            case "backspace":
                this.value = this.value.substring(0, this.value.length - 1);
                if (this.value == "") {
                    const alert = document.getElementById("mainPinpad");
                    alert.style.top = '-40%';
                    alert.style.opacity = 0;
                    document.getElementById('freezeLayer').style.display = 'none';
                }
                break;

            case "done":
                this._attemptLogin();
                break;
            default:
                if (this.value.length < this.maxNumbers && !isNaN(key)) {
                    this.value += key;
                }
                break;
        }

        this._updateValueText();
    }

    _updateValueText() {
        this.el.textDisplay.value = "_".repeat(this.value.length);
        this.el.textDisplay.classList.remove("password--error");
    }

    _initCharts() {
        const charts = document.querySelectorAll(".chart-data");
        charts.forEach((el, index) => {
            this.chart.push(el.id);
            index = document.getElementById(el.id).getContext("2d");
            index.beginPath();
            index.setLineDash([]);
            index.lineTo(600, 300);
            
            this.chart[el.id] = new Chart(index, {
                type: "line",
                data: {datasets: [{ label: `${el.id.toUpperCase()}`,}],
            },
                options: {
                    legend: {labels:{color: 'white'}},
                    maintainAspectRatio: false,
                    responsive: true,
                    borderWidth: 1,
                    borderColor: ['rgba(255, 99, 132, 1)',],
                    scales: {
                        x: {
                            display: true,
                            grid: {
                                color: "#FFFFFF"
                                }
                            },
                        y: {
                            display: true,
                            grid: {
                                color: "#FFFFFF"
                            },
                        }
                    }
                }
            })
        })
        // console.log(this.chart);
    }

    // Add/Remove Data in Charts
    addChartData(arrVar, label, data) {
        this.chart[arrVar].data.labels.push(label);
        this.chart[arrVar].data.datasets.forEach((dataset) => {
            dataset.data.push(data);
        });
        this.chart[arrVar].update();
    }

    removeChartFirstData(arrVar) {
        this.chart[arrVar].data.labels.splice(0, 1);
        this.chart[arrVar].data.datasets.forEach((dataset) => {
            dataset.data.shift();
        });
    }
    
    watchSolarData(obj, propName, callback) {
        var batteryInner = document.getElementsByClassName('battery-liquid')[0];
        var batteryStatus = document.getElementById("batt-ss-1");
        let value = obj[propName];
        Object.defineProperty(obj, propName, {
            get() {
                return value;
            },
            set(newValue) {
                if (newValue !== value && newValue > value) {
                    batteryStatus.innerHTML = "Charging... <i class='ri-flashlight-line animated-green'></i>";
                    batteryInner.style.height = newValue + '%';
                    const oldValue = value;
                    value = newValue;
                    callback(newValue, oldValue);

                    if (value == 100) {
                        batteryStatus.innerHTML = "Full Battery <i class='ri-battery-2-fill green-color'></i>";
                        batteryInner.style.height = newValue + '%';
                        batteryInner.classList.add('gradient-color-green');
                        batteryInner.classList.remove('gradient-color-red','gradient-color-orange','gradient-color-yellow');
                    }
                    else if (value > 20 && value <=40) {
                        batteryInner.classList.add('gradient-color-orange');
                        batteryInner.classList.remove('gradient-color-red','gradient-color-yellow','gradient-color-green');
                        batteryInner.style.height = newValue + '%';
                    }
                    else if (value > 40) {
                        batteryInner.classList.add('gradient-color-yellow');
                        batteryInner.classList.remove('gradient-color-red','gradient-color-orange','gradient-color-green');
                        batteryInner.style.height = newValue + '%';
                    }
                }
                    
                
                else if (newValue <= 20) {
                    batteryInner.classList.add('gradient-color-red');
                    batteryInner.classList.remove('gradient-color-orange','gradient-color-yellow','gradient-color-green');
                    batteryStatus.innerHTML = "Low Battery <i class='ri-plug-line animated-red'></i>";
                    batteryInner.style.height = newValue + '%';
                    const oldValue = value;
                    value = newValue;
                    callback(newValue, oldValue);
                }
                else {
                    if (newValue <= 40) {
                        batteryInner.classList.add('gradient-color-orange');
                        batteryInner.classList.remove('gradient-color-red','gradient-color-yellow','gradient-color-green');
                        batteryInner.style.height = newValue + '%';
                        const oldValue = value;
                        value = newValue;
                        callback(newValue, oldValue);
                    }
                    else if (newValue <= 80) {
                        batteryInner.classList.add('gradient-color-yellow');
                        batteryInner.classList.remove('gradient-color-red','gradient-color-orange','gradient-color-green');
                        batteryInner.style.height = newValue + '%';
                        const oldValue = value;
                        value = newValue;
                        callback(newValue, oldValue);
                    }
                    
                    batteryStatus.innerHTML = "In Use <i class='ri-plug-line animated-green'></i>";
                    batteryInner.style.height = newValue + '%';
                    const oldValue = value;
                    value = newValue;
                    callback(newValue, oldValue);
                }
            },
        });
    }

    watchGaugeData(el, gaugeData) {
        const arc = document.querySelector(`#${el} path`);
        const arc_length = arc.getTotalLength();
        const temp = document.querySelector("#temp1");
        temp.innerHTML = parseInt(gaugeData);
        arc.style.strokeDasharray = `${parseInt(gaugeData)} ${arc_length}`
    }
    
    // Buttons
    sidebarBtn() {
        let sideBtnInner = document.querySelector(".menu-icon");
        let sideBtnOuter = document.querySelector(".menu-outer");
        let sidebar = document.querySelector("#sidebar");

    //allow element to adjust dynamically based on sidebar size
        const gauge = document.querySelectorAll("#gauge");
        const appliance = document.querySelectorAll(".appliance-card");
        const solar = document.querySelectorAll(".pv-card");
        const canvas = document.querySelectorAll(".canvas-card");
        
        sideBtnInner.onclick = () => {
            sidebar.classList.toggle("active");
            gauge.forEach(el => {
                if (sidebar.classList.contains("active")) {
                    el.style.marginLeft = "32px";
                }
                else {
                    el.style.marginLeft = "13px";
                }
            })
                
            appliance.forEach(el => {
                if (sidebar.classList.contains("active")) {
                    el.style.marginLeft = "32px";
                }
                else {
                    el.style.marginLeft = "13px";
                }
            })
            solar.forEach(el => {
                if (sidebar.classList.contains("active")) {
                    el.style.marginLeft = "40px";
                    el.style.width = "13rem";
                }
                else {
                    el.style.marginLeft = "13px";
                    el.style.width = "12.6rem";
                }
            })
            canvas.forEach(el => {
                if (sidebar.classList.contains("active")) {
                    el.style.width = "450px";
                }
                else {
                    el.style.width = "380px";
                }
            })
        }

        sideBtnOuter.onclick = () => {
            sidebar.classList.toggle("active");
            gauge.forEach(el => {
                if (sidebar.classList.contains("active")) {
                    el.style.marginLeft = "32px";
                }
                else {
                    el.style.marginLeft = "13px";
                }
            })
                
            appliance.forEach(el => {
                if (sidebar.classList.contains("active")) {
                    el.style.marginLeft = "32px";
                }
                else {
                    el.style.marginLeft = "13px";
                }
            })
            solar.forEach(el => {
                if (sidebar.classList.contains("active")) {
                    el.style.marginLeft = "35px";
                    el.style.width = "13rem";
                }
                else {
                    el.style.marginLeft = "13px";
                    el.style.width = "12.6rem";
                }
            })
            canvas.forEach(el => {
                if (sidebar.classList.contains("active")) {
                    el.style.width = "450px";
                }
                else {
                    el.style.width = "380px";
                }
            })
        }
    }

    securityBtn() {
        const securityBtn = document.querySelector(".inner-sec-btn");
        const checkBtnActivity = document.querySelectorAll(".bypass-btn");
        checkBtnActivity.forEach((act) => {
            if (act.classList.contains("active")) {
                this.lockPasscode(securityBtn.id)
            }
            else {
                
            }
        })
    }

    switchBtn() {
        var isChecked = document.querySelectorAll('input[type="checkbox"]');
        isChecked.forEach(el => {
            // console.log(el.id);
            el.addEventListener("click", () => {
                if (el.checked == true) {
                    console.log(`Message: ON, ID: ${el.id}`);
                    this.mqttClient.publish("water-consumption", "50");
                }
                else {
                    console.log(`Message: OFF, ID: ${el.id}`);
                    this.mqttClient.publish("water-consumption", "25");
                }
            })
        })
    }

    bypassBtn() {
        const buttons = document.querySelectorAll(".bypass-btn");
        buttons.forEach(el => 
            { el.addEventListener("click", () => {
                this.lockPasscode(el.id)});
            })
    }


    lockPasscode(el) {
        const alert = document.getElementById("mainPinpad");
        alert.style.top = '40%';
        alert.style.opacity = 1;
        document.getElementById('freezeLayer').style.display = 'block';
        this.key = el;
        // this.addActive(el);
    }
    
    unlockPasscode() {
        const alert = document.getElementById("mainPinpad");
        const status = document.getElementById(`sensorStatus-${this.key}`);
        const addActive = document.getElementById(`${this.key}`);
        // const status = document.getElementById(`${this.key}`);
        alert.style.top = '-40%';
        alert.style.opacity = 0;
        document.getElementById('freezeLayer').style.display = 'none';
        status.innerHTML = "BYPASSED";
        status.style.color = "#00B5FF";
        if (addActive.classList.contains("active")) {
            addActive.classList.remove("active");
            status.innerHTML = "Listening...";
        }
        else {
            addActive.classList.add("active");
        }
    }
    
    _attemptLogin() {
        if (this.value.length > 0) {
            
            fetch(this.loginEndpoint,{
                method: "POST",
                cache: "no-cache",
                headers:{
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: `${this.key}=${this.value}`
            }).then(response => {
                console.log(response);
                if  (response.status === 200) {
                    this.unlockPasscode();
                }
                else {
                    this.el.textDisplay.classList.add("password--error");
                }
            })
        }
        this.value = this.value.substring(0, this.value.length - parseInt(this.value));
    }
}
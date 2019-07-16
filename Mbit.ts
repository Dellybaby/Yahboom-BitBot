//% color="#006400" weight=20 icon="\uf1b9"
//% groups='["Motors", "Distance Sensor", "Line Reader","Headlights"]'
namespace mbit_Robot {

    const PCA9685_ADD = 0x41
    const MODE1 = 0x00
    const MODE2 = 0x01
    const SUBADR1 = 0x02
    const SUBADR2 = 0x03
    const SUBADR3 = 0x04

    const LED0_ON_L = 0x06
    const LED0_ON_H = 0x07
    const LED0_OFF_L = 0x08
    const LED0_OFF_H = 0x09

    const ALL_LED_ON_L = 0xFA
    const ALL_LED_ON_H = 0xFB
    const ALL_LED_OFF_L = 0xFC
    const ALL_LED_OFF_H = 0xFD

    const PRESCALE = 0xFE

    let initialized = false

    export enum enPos {

        //% blockId="LeftState" block="Left"
        LeftState = 0,
        //% blockId="RightState" block="Right"
        RightState = 1
    }
    export enum direction {
        forward = 1,
        backward = 2
    }

    export enum enLineState {
        //% blockId="White" block="white"
        White = 0,
        //% blockId="Black" block="black"
        Black = 1
    }
    export enum PingUnit {
        //% block="cm"
        Centimeters,
        //% block="μs"
        MicroSeconds
    }
    export enum Motors {
        LeftMotor = 1,
        RightMotor = 2,
        BothMotor = 3
    }

    function i2cwrite(addr: number, reg: number, value: number) {
        let buf = pins.createBuffer(2)
        buf[0] = reg
        buf[1] = value
        pins.i2cWriteBuffer(addr, buf)
    }

    function i2ccmd(addr: number, value: number) {
        let buf = pins.createBuffer(1)
        buf[0] = value
        pins.i2cWriteBuffer(addr, buf)
    }

    function i2cread(addr: number, reg: number) {
        pins.i2cWriteNumber(addr, reg, NumberFormat.UInt8BE);
        let val = pins.i2cReadNumber(addr, NumberFormat.UInt8BE);
        return val;
    }

    function initPCA9685(): void {
        i2cwrite(PCA9685_ADD, MODE1, 0x00)
        setFreq(50);
        initialized = true
    }

    function setFreq(freq: number): void {
        // Constrain the frequency
        let prescaleval = 25000000;
        prescaleval /= 4096;
        prescaleval /= freq;
        prescaleval -= 1;
        let prescale = prescaleval; //Math.Floor(prescaleval + 0.5);
        let oldmode = i2cread(PCA9685_ADD, MODE1);
        let newmode = (oldmode & 0x7F) | 0x10; // sleep
        i2cwrite(PCA9685_ADD, MODE1, newmode); // go to sleep
        i2cwrite(PCA9685_ADD, PRESCALE, prescale); // set the prescaler
        i2cwrite(PCA9685_ADD, MODE1, oldmode);
        control.waitMicros(5000);
        i2cwrite(PCA9685_ADD, MODE1, oldmode | 0xa1);
    }

    export function setPwm(channel: number, on: number, off: number): void {
        if (channel < 0 || channel > 15)
            return;
        if (!initialized) {
            initPCA9685();
        }
        let buf = pins.createBuffer(5);
        buf[0] = LED0_ON_L + 4 * channel;
        buf[1] = on & 0xff;
        buf[2] = (on >> 8) & 0xff;
        buf[3] = off & 0xff;
        buf[4] = (off >> 8) & 0xff;
        pins.i2cWriteBuffer(PCA9685_ADD, buf);
    }
    //% weight=10
    //% inlineInputMode=inline
    //% blockId=RGB block="Set headlights to Red:%r Green:%g Blue:%b"
    //% r.min=0 r.max=100
    //% g.min=0 g.max=100
    //% b.min=0 b.max=100
    //% group="Headlights"
    export function rgblight(r: number, g: number, b: number): void {
        let buf = pins.createBuffer(4);
        //scaling since 255 wont mean anything to a teacher/student 
        //User sees a value of 100 while program sees the value 255
        let R = r * 40;
        let G = g * 40;
        let B = b * 40;
        if (R > 4096)
            R = 4095;
        if (G > 4096)
            G = 4095;
        if (B > 4096)
            B = 4095;

        setPwm(0, 0, R);
        setPwm(1, 0, G);
        setPwm(2, 0, B);
    }
    //% group="Distance Sensor"
    //% blockId=mbit_ultrasonic_car block="distance sensor value in %unit"
    //% color="#006400"
    //% weight=98
    //% blockGap=10
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=4
    export function Ultrasonic(unit: PingUnit, maxCmDistance = 500): number {
        // send pulse
        pins.setPull(DigitalPin.P14, PinPullMode.PullNone);
        pins.digitalWritePin(DigitalPin.P14, 0);
        control.waitMicros(2);
        pins.digitalWritePin(DigitalPin.P14, 1);
        control.waitMicros(15);
        pins.digitalWritePin(DigitalPin.P14, 0);
        // read pulse
        pins.setPull(DigitalPin.P15, PinPullMode.PullUp);

        let d = pins.pulseIn(DigitalPin.P15, PulseValue.High, maxCmDistance * 42);
        let dr = Math.round(d / 42);
        console.log("Distance: " + dr);

        basic.pause(50)

        switch (unit) {
            case PingUnit.Centimeters: return dr;
            default: return dr;
        }

    }

    //% group="Line Reader"
    //% blockId=mbit_Line_Sensor block="%direct line reader value"
    //% weight=80
    //% blockGap=10
    //% color="#006400"
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=12
    export function Line_Sensor(direct: enPos): number {
        let value = enLineState.Black
        let temp: number = 0;

        switch (direct) {
            case enPos.LeftState: {
                if (pins.analogReadPin(AnalogPin.P2) < 500) {
                    if (value = enLineState.White) {
                        temp = 0;
                    }
                    setPwm(7, 0, 4095);
                }
                else {
                    if (value == enLineState.Black) {
                        temp = 1;
                    }
                    setPwm(7, 0, 0);
                }
                break;
            }

            case enPos.RightState: {
                if (pins.analogReadPin(AnalogPin.P1) < 500) {
                    if (value = enLineState.White) {
                        temp = 1;
                    }
                    setPwm(6, 0, 4095);
                }
                else {
                    if (value == enLineState.Black) {
                        temp = 1;
                    }
                    setPwm(6, 0, 0);
                }
                break;
            }
        }
        return temp;

    }
    //% group="Motors"
    //% blockId=mbit_CarCtrl block="Set %whichmotor to %dir at the speed of %speed"
    //% weight=93
    //% blockGap=10
    //% color="#006400"
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=10
    export function CarCtrl(whichmotor: Motors, dir: direction, speed: number): void {
        speed = speed * 40
        if (speed < 400) {
            speed = 400
        }
        if (whichmotor == Motors.LeftMotor) {
            if (dir == direction.forward) {
                mbit_Robot.setPwm(12, 0, speed);
                mbit_Robot.setPwm(13, 0, 0);

                mbit_Robot.setPwm(15, 0, 0);
                mbit_Robot.setPwm(14, 0, 0);

            }
            else if (dir == direction.backward) {
                mbit_Robot.setPwm(12, 0, 0);
                mbit_Robot.setPwm(13, 0, speed);

                mbit_Robot.setPwm(15, 0, 0);
                mbit_Robot.setPwm(14, 0, 0);
            }

        }
        else if (whichmotor == Motors.RightMotor) {
            if (dir == direction.forward) {
                mbit_Robot.setPwm(12, 0, 0);
                mbit_Robot.setPwm(13, 0, 0);

                mbit_Robot.setPwm(15, 0, speed);
                mbit_Robot.setPwm(14, 0, 0);
            }
            else if (dir == direction.backward) {
                mbit_Robot.setPwm(12, 0, 0);
                mbit_Robot.setPwm(13, 0, 0);

                mbit_Robot.setPwm(15, 0, speed);
                mbit_Robot.setPwm(14, 0, 0);
            }

        }
        else if (whichmotor == Motors.BothMotor) {
            if (dir == direction.forward) {
                mbit_Robot.setPwm(12, 0, speed);
                mbit_Robot.setPwm(13, 0, 0);

                mbit_Robot.setPwm(15, 0, speed);
                mbit_Robot.setPwm(14, 0, 0);
            }
            else if (dir == direction.backward) {
                mbit_Robot.setPwm(12, 0, 0);
                mbit_Robot.setPwm(13, 0, speed);

                mbit_Robot.setPwm(15, 0, 0);
                mbit_Robot.setPwm(14, 0, speed);
            }

        }
    }

    //% group="Motors"
    //% blockId=mbit_CarStop block="Stop %whichmotor"
    //% weight=93
    //% blockGap=10
    //% color="#006400"
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=10
    export function CarStop(whichmotor: Motors): void {
        if (whichmotor == Motors.LeftMotor) {
            mbit_Robot.setPwm(12, 0, 0);
            mbit_Robot.setPwm(13, 0, 0);

            mbit_Robot.setPwm(15, 0, 0);
            mbit_Robot.setPwm(14, 0, 0);
        }

        else if (whichmotor == Motors.RightMotor) {
            mbit_Robot.setPwm(12, 0, 0);
            mbit_Robot.setPwm(13, 0, 0);

            mbit_Robot.setPwm(15, 0, 0);
            mbit_Robot.setPwm(14, 0, 0);
        }
        else if (whichmotor == Motors.BothMotor) {
            mbit_Robot.setPwm(12, 0, 0);
            mbit_Robot.setPwm(13, 0, 0);

            mbit_Robot.setPwm(15, 0, 0);
            mbit_Robot.setPwm(14, 0, 0);
        }
    }

}

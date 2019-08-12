/*
Copyright 2019 GHIElectronics, LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

//% color="#006400" weight=20 icon="\uf1b9"
//% groups='["Motors", "Distance Sensor", "Line Reader","Headlights", "Music", "Servo"]'

namespace BitBot {
    const I2C_ADDRESS = 0x41;
    const MODE1 = 0x00;
    const MODE2 = 0x01;
    const SUBADR1 = 0x02;
    const SUBADR2 = 0x03;
    const SUBADR3 = 0x04;

    const LED0_ON_L = 0x06;
    const LED0_ON_H = 0x07;
    const LED0_OFF_L = 0x08;
    const LED0_OFF_H = 0x09;

    const ALL_LED_ON_L = 0xFA;
    const ALL_LED_ON_H = 0xFB;
    const ALL_LED_OFF_L = 0xFC;
    const ALL_LED_OFF_H = 0xFD;

    const RED_PIN = 0;
    const GREEN_PIN = 1;
    const BLUE_PIN = 2;
    const LEFT_LINE_SENSOR = 7;
    const RIGHT_LINE_SENSOR = 6;
    const LEFT_MOTOR_FORWARD_PIN = 12;
    const LEFT_MOTOR_BACKWARD_PIN = 13;
    const RIGHT_MOTOR_FORWARD_PIN = 15;
    const RIGHT_MOTOR_BACKWARD_PIN = 14;

    const OBJECT_DETECTION_SENSOR_PIN = DigitalPin.P9;
    const OBJECT_DETECTION_SENSOR_VALUE_PIN = AnalogPin.P3;
    const ULTRASONIC_TRIG_PIN = DigitalPin.P14;
    const ULTRASONIC_ECHO_PIN = DigitalPin.P15;

    let SMART_STRIP: neopixel.Strip;

    const PRESCALE_FREQUENCY = 0xFE;

    let INITIALIZED = false;

    export enum Postion {
        //% blockId="LeftState" block="Left"
        LeftState,
        //% blockId="RightState" block="Right"
        RightState
    }

    export enum Direction {
        forward,
        backward
    }

    export enum AvoidState {
        //% blockId="Obstacle" block="a obstacle"
        Obstacle,
        //% blockId="NoObstacle" block="no Obstacle"
        NoObstacle
    }

    export enum LineState {
        //% blockId="White" block="white"
        White,
        //% blockId="Black" block="black"
        Black
    }

    export enum PingUnit {
        //% block="cm"
        Centimeters,
        //% block="μs"
        Microseconds
    }

    export enum Motors {
        Left,
        Right,
        Both
    }

    export enum Servo {
        S1,
        S2,
        S3
    }

    function writeI2C(reg: number, value: number): void {
        let buf = pins.createBuffer(2);

        buf[0] = reg;
        buf[1] = value;

        pins.i2cWriteBuffer(I2C_ADDRESS, buf);
    }

    function writeCommand(value: number): void {
        let buf = pins.createBuffer(1);

        buf[0] = value;

        pins.i2cWriteBuffer(I2C_ADDRESS, buf);
    }

    function i2cread(reg: number) {
        pins.i2cWriteNumber(I2C_ADDRESS, reg, NumberFormat.UInt8BE);

        return pins.i2cReadNumber(I2C_ADDRESS, NumberFormat.UInt8BE);
    }

    function initPCA9685(): void {
        writeI2C(MODE1, 0x00);
        setFreq(50);

        INITIALIZED = true;
    }

    function setFreq(freq: number): void {
        let PRESCALE_FREQUENCY = 25000000;
        PRESCALE_FREQUENCY /= 4096;
        PRESCALE_FREQUENCY /= freq;
        PRESCALE_FREQUENCY -= 1;

        let oldmode = i2cread(MODE1);
        let newmode = (oldmode & 0x7F) | 0x10;

        writeI2C(MODE1, newmode);
        writeI2C(PRESCALE_FREQUENCY, PRESCALE_FREQUENCY);
        writeI2C(MODE1, oldmode);

        control.waitMicros(5000);

        writeI2C(MODE1, oldmode | 0xA1);
    }

    export function setPwm(channel: number, on: number, off: number): void {
        if (channel < 0 || channel > 15)
            return;

        if (!INITIALIZED)
            initPCA9685();

        let buf = pins.createBuffer(5);

        buf[0] = LED0_ON_L + 4 * channel;
        buf[1] = on & 0xFF;
        buf[2] = (on >> 8) & 0xFF;
        buf[3] = off & 0xFF;
        buf[4] = (off >> 8) & 0xFF;

        pins.i2cWriteBuffer(I2C_ADDRESS, buf);
    }

    //% weight=70
    //% inlineInputMode=inline
    //% blockId=RGB block="Set headlights to Red:%r Green:%g Blue:%b"
    //% r.min=0 r.max=100
    //% g.min=0 g.max=100
    //% b.min=0 b.max=100
    //% group="Headlights"
    //% color="#006400"
    export function setLedColor(r: number, g: number, b: number): void {
        let buf = pins.createBuffer(4);
        //scaling since 255 wont mean anything to a teacher/student 
        //User sees a value of 100 while program sees the value 255

        r *= 40;
        g *= 40;
        b *= 40;

        if (r > 4096) r = 4095;
        if (g > 4096) g = 4095;
        if (b > 4096) b = 4095;

        setPwm(RED_PIN, 0, r);
        setPwm(GREEN_PIN, 0, g);
        setPwm(BLUE_PIN, 0, b);
    }

    //% weight=71
    //% group="Line Reader"
    //% blockId=mbit_Line_Sensor block="%direction line sensor detects %value"
    //% blockGap=10
    //% color="#006400"
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=12
    export function readLineSensor(direction: Postion, value: LineState): boolean {
        let pin = direction === Postion.LeftState ? AnalogPin.P2 : AnalogPin.P1;

        if (pins.analogReadPin(pin) < 500) {
            setPwm(LEFT_LINE_SENSOR, 0, 4095);

            return value === LineState.White;
        }
        else {
            setPwm(LEFT_LINE_SENSOR, 0, 0);

            return value === LineState.Black;
        }

        if (pins.analogReadPin(pin) < 500) {
            setPwm(RIGHT_LINE_SENSOR, 0, 4095);

            return value === LineState.White;
        }
        else {
            setPwm(RIGHT_LINE_SENSOR, 0, 0);

            return value === LineState.Black;
        }
    }

    //% weight=100
    //% group="Motors"
    //% blockId=ControlCar block="Set %which to %dir at the speed of %speed"
    //% speed.defl=100
    //% color="#006400"
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=10
    export function setMotorSpeed(which: Motors, dir: Direction, speed: number): void {
        speed *= 40;

        if (speed < 400) {
            speed = 400
        }

        if (which == Motors.Left || which == Motors.Both) {
            if (dir == Direction.forward) {
                BitBot.setPwm(LEFT_MOTOR_FORWARD_PIN, 0, speed);
                BitBot.setPwm(LEFT_MOTOR_BACKWARD_PIN, 0, 0);
            }
            else if (dir == Direction.backward) {
                BitBot.setPwm(LEFT_MOTOR_FORWARD_PIN, 0, 0);
                BitBot.setPwm(LEFT_MOTOR_BACKWARD_PIN, 0, speed);
            }
        }

        if (which == Motors.Right || which == Motors.Both) {
            if (dir == Direction.forward) {
                BitBot.setPwm(RIGHT_MOTOR_FORWARD_PIN, 0, speed);
                BitBot.setPwm(RIGHT_MOTOR_BACKWARD_PIN, 0, 0);
            }
            else if (dir == Direction.backward) {
                BitBot.setPwm(RIGHT_MOTOR_FORWARD_PIN, 0, 0);
                BitBot.setPwm(RIGHT_MOTOR_BACKWARD_PIN, 0, speed);
            }
        }
    }

    //% weight=99
    //% group="Motors"
    //% blockId=mbit_CarStop block="Stop motors"
    //% color="#006400"
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=10
    export function setMotorsOff(): void {
        BitBot.setPwm(LEFT_MOTOR_FORWARD_PIN, 0, 0);
        BitBot.setPwm(LEFT_MOTOR_BACKWARD_PIN, 0, 0);

        BitBot.setPwm(RIGHT_MOTOR_FORWARD_PIN, 0, 0);
        BitBot.setPwm(RIGHT_MOTOR_BACKWARD_PIN, 0, 0);
    }

    //% blockId=RGB_Car_Program block="Smart leds"
    //% weight=50
    //% group="Headlights"    
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=4
    //% color="#006400"
    export function ControlCarSmartLeds(): neopixel.Strip {
        SMART_STRIP !== null && SMART_STRIP !== undefined ? SMART_STRIP : (SMART_STRIP = neopixel.create(DigitalPin.P16, 3, NeoPixelMode.RGB));

        return SMART_STRIP;
    }

    //% blockId=mbit_Music_Car block="Play %index"
    //% color="#006400"
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=4
    //% weight=40
    //% group="Music"   
    export function playMelody(melody: Melodies): void {
        music.beginMelody(music.builtInMelody(melody), MelodyOptions.Once);
    }

    //% blockId=mbit_Servo_Car block="Set Servo %num to %value"
    //% weight=5
    //% blockGap=10
    //% group="Servo"   
    //% color="#006400"
    //% num.min=1 num.max=3 value.min=0 value.max=180
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=9
    export function setServo(num: Servo, value: number): void {
        // 50hz: 20,000 us
        let us = (value * 1800 / 180 + 600); // 0.6 ~ 2.4
        let pwm = us * 4096 / 20000;

        setPwm(num + 2, 0, pwm);
    }

    //% blockId=HelloBot_Avoid_Sensor block="object sensor detects %value"
    //% weight=87
    //% color="#006400"
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=12
    //% group="Object Sensor"
    export function readObjectDetectionSensor(value: AvoidState): boolean {
        let result: boolean = false;
        pins.digitalWritePin(OBJECT_DETECTION_SENSOR_PIN, 0);
        if (value === AvoidState.Obstacle) {
            if (pins.analogReadPin(OBJECT_DETECTION_SENSOR_VALUE_PIN) < 800) {

                result = true;
                setPwm(8, 0, 0);
            }
            else {
                result = false;
                setPwm(8, 0, 4095);
            }
        }
        else {
            if (pins.analogReadPin(OBJECT_DETECTION_SENSOR_VALUE_PIN) > 800) {

                result = true;
                setPwm(8, 0, 4095);
            }
            else {
                result = false;
                setPwm(8, 0, 0);
            }
        }

        pins.digitalWritePin(OBJECT_DETECTION_SENSOR_PIN, 1);
        return result;
    }

    //% weight=30
    //% group="Distance Sensor"
    //% blockId=ultrasonic_car block="distance sensor value in %unit"
    //% color="#006400"
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=4
    export function readUltrasonicSensor(unit: PingUnit): number {
        // send pulse
        pins.setPull(ULTRASONIC_TRIG_PIN, PinPullMode.PullNone);
        pins.digitalWritePin(ULTRASONIC_TRIG_PIN, 0);
        control.waitMicros(2);
        pins.digitalWritePin(ULTRASONIC_TRIG_PIN, 1);
        control.waitMicros(15);
        pins.digitalWritePin(ULTRASONIC_TRIG_PIN, 0);

        // read pulse
        pins.setPull(ULTRASONIC_ECHO_PIN, PinPullMode.PullUp);

        let d = pins.pulseIn(ULTRASONIC_ECHO_PIN, PulseValue.High, 21000);

        d = Math.round(d);

        return d;
    }
}

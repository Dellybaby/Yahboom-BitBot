//////////////////////////////////////////////////////////////
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
//////////////////////////////////////////////////////////////////////////
//% color="#006400" weight=20 icon="\uf1b9"
//% groups='["Motors", "Distance Sensor", "Line Reader","Headlights", "Music", "Servo"]'

let SmartStrip: neopixel.Strip;

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

    const redPin = 0;
    const greenPin = 1;
    const bluePin = 2;
    const LeftLineSensor = 7;
    const RightLineSensor = 6;
    const LeftMotorForwardPin = 12
    const LeftMotorBackwardPin = 13
    const RightMotorForwardPin = 15
    const RightMotorBackwardPin = 14

    const PRESCALE = 0xFE;

    let initialized = false;

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
        MicroSeconds
    }

    export enum Motors {
        LeftMotor,
        RightMotor,
        BothMotor
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

        initialized = true;
    }

    function setFreq(freq: number): void {
        let prescale = 25000000;
        prescale /= 4096;
        prescale /= freq;
        prescale -= 1;

        let oldmode = i2cread(MODE1);
        let newmode = (oldmode & 0x7F) | 0x10;

        writeI2C(MODE1, newmode);
        writeI2C(PRESCALE, prescale);
        writeI2C(MODE1, oldmode);

        control.waitMicros(5000);

        writeI2C(MODE1, oldmode | 0xA1);
    }

    export function setPwm(channel: number, on: number, off: number): void {
        if (channel < 0 || channel > 15)
            return;

        if (!initialized)
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
    export function rgblight(r: number, g: number, b: number): void {
        let buf = pins.createBuffer(4);
        //scaling since 255 wont mean anything to a teacher/student 
        //User sees a value of 100 while program sees the value 255

        r *= 40;
        g *= 40;
        b *= 40;

        if (r > 4096) r = 4095;
        if (g > 4096) g = 4095;
        if (b > 4096) b = 4095;

        setPwm(redPin, 0, r);
        setPwm(greenPin, 0, g);
        setPwm(bluePin, 0, b);
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
            setPwm(LeftLineSensor, 0, 4095);

            return value === LineState.White;
        }
        else {
            setPwm(LeftLineSensor, 0, 0);

            return value === LineState.Black;
        }
        if (pins.analogReadPin(pin) < 500) {
            setPwm(RightLineSensor, 0, 4095);

            return value === LineState.White;
        }
        else {
            setPwm(RightLineSensor, 0, 0);

            return value === LineState.Black;
        }
    }

    //% weight=100
    //% group="Motors"
    //% blockId=ControlCar block="Set %whichmotor to %dir at the speed of %speed"
    //% speed.defl=100
    //% color="#006400"
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=10
    export function ControlCarMotors(whichmotor: Motors, dir: Direction, speed: number): void {
        speed *= 40;


        if (speed < 400) {
            speed = 400
        }

        if (whichmotor == Motors.LeftMotor || whichmotor == Motors.BothMotor) {
            if (dir == Direction.forward) {
                BuildingBit.setPwm(LeftMotorForwardPin, 0, speed);
                BuildingBit.setPwm(LeftMotorBackwardPin, 0, 0);
            }
            else if (dir == Direction.backward) {
                BuildingBit.setPwm(LeftMotorForwardPin, 0, 0);
                BuildingBit.setPwm(LeftMotorBackwardPin, 0, speed);
            }
            else {
                BuildingBit.setPwm(LeftMotorForwardPin, 0, 0);
                BuildingBit.setPwm(LeftMotorBackwardPin, 0, 0);
            }

        }

        if (whichmotor == Motors.RightMotor || whichmotor == Motors.BothMotor) {
            if (dir == Direction.forward) {
                BuildingBit.setPwm(RightMotorForwardPin, 0, speed);
                BuildingBit.setPwm(RightMotorBackwardPin, 0, 0);
            }
            else if (dir == Direction.backward) {
                BuildingBit.setPwm(RightMotorForwardPin, 0, 0);
                BuildingBit.setPwm(RightMotorBackwardPin, 0, speed);
            }
            else {
                BuildingBit.setPwm(RightMotorForwardPin, 0, 0);
                BuildingBit.setPwm(RightMotorBackwardPin, 0, 0);
            }
        }
    }

    //% weight=99
    //% group="Motors"
    //% blockId=mbit_CarStop block="Stop motors"
    //% color="#006400"
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=10
    export function StopCar(): void {
        BuildingBit.setPwm(LeftMotorForwardPin, 0, 0);
        BuildingBit.setPwm(LeftMotorBackwardPin, 0, 0);

        BuildingBit.setPwm(RightMotorForwardPin, 0, 0);
        BuildingBit.setPwm(RightMotorBackwardPin, 0, 0);
    }

    //% blockId=RGB_Car_Program block="Smart leds"
    //% weight=50
    //% group="Headlights"    
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=4
    //% color="#006400"
    export function RGB_Car_Program(): neopixel.Strip {
        if (SmartStrip === null || SmartStrip === undefined) {
            SmartStrip = neopixel.create(DigitalPin.P16, 3, NeoPixelMode.RGB);
        }
        return SmartStrip;
    }

    //% blockId=mbit_Music_Car block="Play %index"
    //% color="#006400"
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=4
    //% weight=40
    //% group="Music"   
    export function Music_Car(melody: Melodies): void {
        music.beginMelody(music.builtInMelody(melody), MelodyOptions.Once);
    }

    //% blockId=mbit_Servo_Car block="Set Servo %num to %value"
    //% weight=5
    //% blockGap=10
    //% group="Servo"   
    //% color="#006400"
    //% num.min=1 num.max=3 value.min=0 value.max=180
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=9
    export function Servo_Car(num: Servo, value: number): void {
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
    export function Avoid_Sensor(value: AvoidState): boolean {
        let AvoidValue: boolean = false;
        pins.digitalWritePin(DigitalPin.P9, 0);
        switch (value) {
            case AvoidState.Obstacle: {
                if (pins.analogReadPin(AnalogPin.P3) < 800) {

                    AvoidValue = true;
                    setPwm(8, 0, 0);
                }
                else {
                    AvoidValue = false;
                    setPwm(8, 0, 4095);
                }
                break;
            }
            case AvoidState.NoObstacle: {
                if (pins.analogReadPin(AnalogPin.P3) > 800) {

                    AvoidValue = true;
                    setPwm(8, 0, 4095);
                }
                else {
                    AvoidValue = false;
                    setPwm(8, 0, 0);
                }
                break;
            }
        }
        pins.digitalWritePin(DigitalPin.P9, 1);
        return AvoidValue;
    }

    //% weight=30
    //% group="Distance Sensor"
    //% blockId=ultrasonic_car block="distance sensor value in %unit"
    //% color="#006400"
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=4
    export function readUltrasonicSensor(unit: PingUnit): number {
        // send pulse
        pins.setPull(DigitalPin.P14, PinPullMode.PullNone);
        pins.digitalWritePin(DigitalPin.P14, 0);
        control.waitMicros(2);
        pins.digitalWritePin(DigitalPin.P14, 1);
        control.waitMicros(15);
        pins.digitalWritePin(DigitalPin.P14, 0);

        // read pulse
        pins.setPull(DigitalPin.P15, PinPullMode.PullUp);

        let d = pins.pulseIn(DigitalPin.P15, PulseValue.High, 500);

        d = Math.round(d);

        console.log("Distance: " + d);

        basic.pause(50)

        return d;
    }
}

/**
 * Tox'sCraft DayNightCycle
 * Manages game time, tick rates, and calculates day/night ratios.
 */

import { SECONDS_PER_DAY } from '../constants';
import { eventBus } from '../EventBus';

export class DayNightCycle {
  // Time represented as 0.0 (sunrise/morning) to 1.0 (next day)
  private time = 0.0;
  private timeRate = 1 / SECONDS_PER_DAY; // speed of day cycle
  private daysElapsed = 0;

  constructor(initialTime = 0.1) {
    this.time = initialTime; // Spawn slightly after sunrise
  }

  /**
   * Increments time based on delta step
   */
  public update(deltaSec: number): void {
    this.time += this.timeRate * deltaSec;
    
    // Cycle check
    if (this.time >= 1.0) {
      this.time -= 1.0;
      this.daysElapsed++;
      eventBus.emit('new_day', this.daysElapsed);
    }
  }

  /**
   * Get current time (0 to 1)
   */
  public getTime(): number {
    return this.time;
  }

  /**
   * Set specific time (0 to 1)
   */
  public setTime(time: number): void {
    this.time = Math.max(0.0, Math.min(1.0, time));
    eventBus.emit('time_change', this.time);
  }

  /**
   * Returns human-readable time string (e.g. "08:30 AM")
   */
  public getTimeString(): string {
    // Offset so 0.0 is 06:00 AM (Sunrise)
    const rawHours = (this.time * 24 + 6) % 24;
    const hours = Math.floor(rawHours);
    const minutes = Math.floor((rawHours - hours) * 60);

    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;

    return `${displayHours}:${displayMinutes} ${ampm}`;
  }

  public getDaysElapsed(): number {
    return this.daysElapsed;
  }

  public setDaysElapsed(val: number): void {
    this.daysElapsed = val;
  }
}

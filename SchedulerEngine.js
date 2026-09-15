class ZbiboCoachEngine {
  constructor() {
    this.minimumSleepMinutes = 8 * 60;

    this.routines = {
      quickConditioning: {
        name: "Time-Crunch EMOM",
        details: "Rowing, Medicine Ball Slams, and Kettlebell Swings",
        durationMinutes: 30
      },
      preWorkSafe: {
        name: "Upper-Body Push",
        details: "Incline Push-ups and Tricep Extensions",
        durationMinutes: 60
      },
      heavyOffDay: {
        name: "Heavy Lower-Body",
        details: "Squats, Deadlifts, Heavy Leg Press",
        durationMinutes: 90
      }
    };
  }

  generateDailyPlan(workStartHour, workEndHour, isNextDayDemanding) {
    this.validateHour(workStartHour, "workStartHour");
    this.validateHour(workEndHour, "workEndHour");

    const startMinutes = Math.round(workStartHour * 60);
    const endMinutes = Math.round(workEndHour * 60);
    const isOffDay = startMinutes === endMinutes;
    const workDuration = isOffDay
      ? 0
      : (endMinutes - startMinutes + 24 * 60) % (24 * 60);
    let workoutObj;

    if (isOffDay) {
      workoutObj = this.routines.heavyOffDay;
    } else if (workDuration > 8 * 60) {
      workoutObj = this.routines.quickConditioning;
    } else if (isNextDayDemanding) {
      workoutObj = this.routines.preWorkSafe;
    } else {
      workoutObj = this.routines.preWorkSafe;
    }

    const wakeUpTime = startMinutes - workoutObj.durationMinutes - 2 * 60;
    const gymTime = wakeUpTime + 30;
    const postWorkoutMeal = gymTime + workoutObj.durationMinutes;
    const bedTime = wakeUpTime - this.minimumSleepMinutes;

    return {
      bedTime: this.formatTime(bedTime),
      wakeUp: this.formatTime(wakeUpTime),
      gym: {
        time: this.formatTime(gymTime),
        routine: workoutObj
      },
      mealPrep: this.formatTime(postWorkoutMeal),
      workStart: this.formatTime(startMinutes)
    };
  }

  validateHour(hour, name) {
    if (!Number.isFinite(hour) || hour < 0 || hour >= 24) {
      throw new RangeError(`${name} must be between 00:00 and 23:59`);
    }
  }

  formatTime(totalMinutes) {
    totalMinutes = Math.round(totalMinutes);
    const minutesInDay = 24 * 60;
    const normalizedMinutes = ((totalMinutes % minutesInDay) + minutesInDay) % minutesInDay;
    const dayOffset = Math.floor(totalMinutes / minutesInDay);
    const hours = Math.floor(normalizedMinutes / 60);
    const minutes = normalizedMinutes % 60;
    const period = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 || 12;
    const dayLabel = dayOffset < 0
      ? " (previous day)"
      : dayOffset > 0
        ? " (next day)"
        : "";

    return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}${dayLabel}`;
  }
}

export default ZbiboCoachEngine;

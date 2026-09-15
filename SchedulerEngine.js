class ZbiboCoachEngine {
  constructor() {
    this.minimumSleep = 8; // hours
    
    // Custom Gym Routine Database
    this.routines = {
      quickConditioning: {
        name: "Time-Crunch EMOM",
        details: "Rowing, Medicine Ball Slams, and Kettlebell Swings",
        duration: 0.5 // hours
      },
      preWorkSafe: {
        name: "Upper-Body Push",
        details: "Incline Push-ups and Tricep Extensions",
        duration: 1.0 // hours
      },
      heavyOffDay: {
        name: "Heavy Lower-Body",
        details: "Squats, Deadlifts, Heavy Leg Press",
        duration: 1.5 // hours
      }
    };
  }

  generateDailyPlan(workStartHour, workEndHour, isNextDayDemanding) {
    let workoutObj = null;
    let workDuration = workEndHour - workStartHour;

    // 1. Fatigue Management Routing
    if (workDuration === 0) {
      // Off day: Deploy heavy lower body
      workoutObj = this.routines.heavyOffDay;
    } else if (workDuration > 8) {
      // Long shift: Deploy quick high-intensity conditioning
      workoutObj = this.routines.quickConditioning;
    } else if (isNextDayDemanding) {
      // Protect the legs for work tomorrow: Deploy upper body push
      workoutObj = this.routines.preWorkSafe;
    } else {
       workoutObj = this.routines.preWorkSafe; // Default active day
    }

    // 2. Schedule Calculation (Example: Morning Workout before shift)
    const wakeUpTime = workStartHour - 2.5; // Commute, food, gym buffer
    const gymTime = wakeUpTime + 0.5;
    const postWorkoutMeal = gymTime + workoutObj.duration;
    const bedTime = wakeUpTime - this.minimumSleep;

    return {
      bedTime: this.formatTime(bedTime),
      wakeUp: this.formatTime(wakeUpTime),
      gym: {
        time: this.formatTime(gymTime),
        routine: workoutObj
      },
      mealPrep: this.formatTime(postWorkoutMeal),
      workStart: this.formatTime(workStartHour)
    };
  }

  formatTime(decimalTime) {
    // Helper to convert 7.5 to "07:30 AM" (Simplified for example)
    let hours = Math.floor(decimalTime);
    if (hours < 0) hours += 24;
    return `${hours}:00`; 
  }
}

export default ZbiboCoachEngine;

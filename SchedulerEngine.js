class ZbiboCoachEngine {
  constructor(routines = {}) {
    this.minimumSleepMinutes = 8 * 60;
    this.commuteMinutes = 45;
    this.prepMinutes = 45;
    this.recoveryMealMinutes = 45;
    this.criticalEnergyExpenditure = 2800;
    this.routines = {
      high: { name: 'Heavy Lower-Body', details: 'Squats, deadlifts, and heavy leg press', durationMinutes: 90, intensity: 'high' },
      medium: { name: 'Upper-Body Push', details: 'Incline push-ups and tricep extensions', durationMinutes: 60, intensity: 'medium' },
      low: { name: '20-min Kettlebell / Rowing EMOM', details: 'Low-impact conditioning with a controlled pace', durationMinutes: 30, intensity: 'low' },
      ...routines
    };
  }

  setRoutines(routines) { this.routines = { ...this.routines, ...routines }; }

  generateDailyPlan(workStartHour, workEndHour, isNextDayDemanding = false, options = {}) {
    this.validateHour(workStartHour, 'workStartHour');
    this.validateHour(workEndHour, 'workEndHour');
    const startMinutes = Math.round(workStartHour * 60);
    const endMinutes = Math.round(workEndHour * 60);
    const isOffDay = startMinutes === endMinutes;
    const workDurationMinutes = isOffDay ? 0 : (endMinutes - startMinutes + 1440) % 1440;
    const energyExpenditure = options.energyExpenditure ?? this.estimateEnergyExpenditure(workDurationMinutes);
    const routine = options.routine || this.selectRoutine({ isOffDay, workDurationMinutes, isNextDayDemanding, energyExpenditure });

    if (routine === null || routine.isRest) {
      return { status: 'rest', reason: 'Estimated energy expenditure crossed the recovery threshold.', energyExpenditure, workStart: this.formatTime(startMinutes), timeline: [] };
    }

    const workStart = isOffDay ? 9 * 60 : startMinutes;
    const commuteStart = workStart - this.commuteMinutes;
    const prepStart = commuteStart - this.prepMinutes;
    const mealStart = prepStart - this.recoveryMealMinutes;
    const gymStart = mealStart - routine.durationMinutes;
    const wakeUp = gymStart - 30;
    const bedTime = wakeUp - this.minimumSleepMinutes;
    return {
      status: 'scheduled', energyExpenditure, workDurationMinutes,
      bedTime: this.formatTime(bedTime), wakeUp: this.formatTime(wakeUp),
      gym: { time: this.formatTime(gymStart), routine }, mealPrep: this.formatTime(mealStart),
      recoveryMeal: this.formatTime(mealStart), commute: this.formatTime(commuteStart), workStart: this.formatTime(workStart),
      timeline: [
        { label: 'Sleep', time: this.formatTime(bedTime), detail: '8-hour recovery block' },
        { label: 'Wake', time: this.formatTime(wakeUp), detail: 'Start the day' },
        { label: 'Gym', time: this.formatTime(gymStart), detail: routine.name },
        { label: 'Recovery meal', time: this.formatTime(mealStart), detail: '45-minute nutrition block' },
        { label: 'Prep + commute', time: this.formatTime(prepStart), detail: '45-minute prep, then commute' },
        { label: 'Work', time: this.formatTime(workStart), detail: isOffDay ? 'Off day anchor' : 'Shift begins' }
      ]
    };
  }

  generateWeeklyPlan(shifts, options = {}) {
    let fatigueCarry = 0;

    return shifts.map((shift, index) => {
      const nextShift = shifts[index + 1];
      const workDurationMinutes = this.getWorkDurationMinutes(shift.start, shift.end);
      const nextWorkDurationMinutes = nextShift ? this.getWorkDurationMinutes(nextShift.start, nextShift.end) : 0;
      const nextDayDemanding = shift.isNextDayDemanding
        ?? shift.demanding
        ?? nextWorkDurationMinutes >= 8 * 60;
      const estimatedEnergy = shift.energyExpenditure
        ?? options.energyExpenditure
        ?? this.estimateEnergyExpenditure(workDurationMinutes);
      const plan = this.generateDailyPlan(shift.start, shift.end, nextDayDemanding, {
        energyExpenditure: estimatedEnergy + fatigueCarry,
        routine: shift.trainingSlot
      });

      fatigueCarry = plan.status === 'rest'
        ? 0
        : Math.max(0, fatigueCarry + Math.max(0, estimatedEnergy - 2200) - 500);

      return { ...shift, day: shift.day || `Day ${index + 1}`, plan };
    });
  }

  getWorkDurationMinutes(workStartHour, workEndHour) {
    const startMinutes = Math.round(workStartHour * 60);
    const endMinutes = Math.round(workEndHour * 60);
    return startMinutes === endMinutes ? 0 : (endMinutes - startMinutes + 1440) % 1440;
  }

  selectRoutine({ isOffDay, workDurationMinutes, isNextDayDemanding, energyExpenditure }) {
    if (energyExpenditure >= this.criticalEnergyExpenditure) return null;
    if (isOffDay || workDurationMinutes < 4 * 60) return this.routines.high;
    if (isNextDayDemanding || workDurationMinutes > 8 * 60) return this.routines.low;
    return this.routines.medium;
  }

  estimateEnergyExpenditure(workDurationMinutes) { return Math.round(1800 + (workDurationMinutes / 60) * 130); }

  validateHour(hour, name) {
    if (!Number.isFinite(hour) || hour < 0 || hour >= 24) throw new RangeError(`${name} must be between 00:00 and 23:59`);
  }

  formatTime(totalMinutes) {
    const normalizedTotal = Math.round(totalMinutes);
    const normalizedMinutes = ((normalizedTotal % 1440) + 1440) % 1440;
    const dayOffset = Math.floor(normalizedTotal / 1440);
    const hours = Math.floor(normalizedMinutes / 60);
    const minutes = normalizedMinutes % 60;
    const dayLabel = dayOffset < 0 ? ' (previous day)' : dayOffset > 0 ? ' (next day)' : '';
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}${dayLabel}`;
  }
}

export default ZbiboCoachEngine;

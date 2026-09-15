import React, { useMemo, useState } from 'react';
import ZbiboCoachEngine from './SchedulerEngine';
import { extractRotaFromImage } from './RotaOCR';
import './styles.css';

const defaultShifts = [
  { day: 'Monday', start: 9, end: 17, demanding: true },
  { day: 'Tuesday', start: 9, end: 17, demanding: false }
];

const defaultRoutines = {
  high: { name: 'Heavy Lower-Body', details: 'Squats, deadlifts, and heavy leg press', durationMinutes: 90, intensity: 'high' },
  medium: { name: 'Upper-Body Push', details: 'Incline push-ups and tricep extensions', durationMinutes: 60, intensity: 'medium' },
  low: { name: '20-min Kettlebell / Rowing EMOM', details: 'Low-impact conditioning with a controlled pace', durationMinutes: 30, intensity: 'low' }
};

function timeToHours(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours + minutes / 60;
}

function hoursToTime(value) {
  const hours = Math.floor(value).toString().padStart(2, '0');
  const minutes = Math.round((value % 1) * 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function shiftFromForm(formData) {
  return {
    day: 'Today',
    start: timeToHours(formData.get('workStart')),
    end: timeToHours(formData.get('workEnd')),
    demanding: formData.get('demandingDay') === 'on'
  };
}

export default function App() {
  const [shifts, setShifts] = useState(defaultShifts);
  const [routines, setRoutines] = useState(defaultRoutines);
  const [weeklyPlans, setWeeklyPlans] = useState([]);
  const [activePlan, setActivePlan] = useState(null);
  const [ocrStatus, setOcrStatus] = useState('');
  const [error, setError] = useState('');
  const [showRoutines, setShowRoutines] = useState(false);
  const coach = useMemo(() => new ZbiboCoachEngine(routines), [routines]);

  const handleGenerate = (event) => {
    event.preventDefault();
    try {
      const shift = shiftFromForm(new FormData(event.currentTarget));
      const plans = coach.generateWeeklyPlan([shift]);
      setShifts([shift]);
      setWeeklyPlans(plans);
      setActivePlan(plans[0]);
      setError('');
    } catch (generationError) {
      setError(generationError.message);
    }
  };

  const handleRoutineChange = (intensity, field, value) => {
    setRoutines((current) => ({
      ...current,
      [intensity]: { ...current[intensity], [field]: field === 'durationMinutes' ? Number(value) : value }
    }));
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setOcrStatus('Reading rota image...');
    try {
      const result = await extractRotaFromImage(file, ({ status, progress }) => {
        setOcrStatus(`${status} ${Math.round(progress * 100)}%`);
      });
      if (!result.shifts.length) throw new Error('No work-time pairs were found. Try a clearer rota image.');
      const plans = coach.generateWeeklyPlan(result.shifts);
      setShifts(result.shifts);
      setWeeklyPlans(plans);
      setActivePlan(plans[0]);
      setOcrStatus(`${result.shifts.length} shift${result.shifts.length === 1 ? '' : 's'} imported`);
    } catch (ocrError) {
      setOcrStatus('');
      setError(ocrError.message || 'The rota could not be read.');
    }
  };

  return (
    <div className="app-container">
      <header className="hero">
        <div className="brand-row"><span className="brand-mark">Z</span><span>zbibo / lifestyle architecture</span></div>
        <p className="eyebrow">Your week, intelligently arranged</p>
        <h1 className="header-greeting">Make room for <span className="highlight">what keeps you well.</span></h1>
        <p className="hero-copy">Upload a rota or enter a shift. Zbibo protects recovery first, then builds the training around it.</p>
      </header>

      <main>
        <section className="glass-card ingestion-card">
          <div className="section-heading">
            <div><p className="eyebrow">01 / Ingest</p><h2>Bring in your rota</h2></div>
            <span className="status-dot" aria-hidden="true" />
          </div>
          <label className="dropzone">
            <input type="file" accept="image/*" onChange={handleImageUpload} />
            <span className="upload-icon" aria-hidden="true">+</span>
            <strong>Drop a rota image here</strong>
            <span>PNG, JPG, or a phone photo. OCR runs in your browser.</span>
          </label>
          {ocrStatus && <p className="progress-message">{ocrStatus}</p>}
          <div className="or-divider"><span>or enter a single shift</span></div>
          <form onSubmit={handleGenerate}>
            <div className="form-grid">
              <label>Shift starts<input type="time" name="workStart" defaultValue="09:00" required /></label>
              <label>Shift ends<input type="time" name="workEnd" defaultValue="17:00" required /></label>
            </div>
            <label className="checkbox-label"><input type="checkbox" name="demandingDay" defaultChecked /> Tomorrow is a demanding work day</label>
            <button type="submit" className="upload-btn">Build my timeline <span aria-hidden="true">-&gt;</span></button>
          </form>
          {error && <p className="error-message" role="alert">{error}</p>}
        </section>

        <section className="glass-card routine-card">
          <button className="section-toggle" type="button" onClick={() => setShowRoutines((visible) => !visible)} aria-expanded={showRoutines}>
            <span><p className="eyebrow">02 / Personalize</p><h2>Your training library</h2></span><span className="toggle-icon">{showRoutines ? '-' : '+'}</span>
          </button>
          {showRoutines && <div className="routine-editor">{Object.entries(routines).map(([intensity, routine]) => (
            <div className="routine-row" key={intensity}>
              <span className={`intensity intensity-${intensity}`}>{intensity}</span>
              <input aria-label={`${intensity} routine name`} value={routine.name} onChange={(event) => handleRoutineChange(intensity, 'name', event.target.value)} />
              <input aria-label={`${intensity} routine duration`} type="number" min="10" max="180" step="5" value={routine.durationMinutes} onChange={(event) => handleRoutineChange(intensity, 'durationMinutes', event.target.value)} />
              <span className="minutes-label">min</span>
            </div>
          ))}</div>}
        </section>

        {activePlan && <section className="glass-card result-card active-task-glow">
          <div className="section-heading"><div><p className="eyebrow">03 / Architecture</p><h2>{activePlan.plan.status === 'rest' ? 'Recovery is the plan' : 'Your timeline is ready'}</h2></div><span className="result-mark">{activePlan.plan.status === 'rest' ? 'REST' : 'LIVE'}</span></div>
          {activePlan.plan.status === 'rest' ? <p className="rest-copy">{activePlan.plan.reason} The engine has removed training so your next day can carry less fatigue.</p> : <>
            <div className="metric-strip"><div><span>Energy load</span><strong>{activePlan.plan.energyExpenditure} kcal</strong></div><div><span>Sleep protected</span><strong>8 hours</strong></div><div><span>Routine</span><strong>{activePlan.plan.gym.routine.intensity}</strong></div></div>
            <div className="timeline">{activePlan.plan.timeline.map((item) => <div className="timeline-item" key={`${item.label}-${item.time}`}><span className="timeline-time">{item.time}</span><span className="timeline-line" /><div><strong>{item.label}</strong><span>{item.detail}</span></div></div>)}</div>
          </>}
        </section>}

        {weeklyPlans.length > 1 && <section className="week-list"><p className="eyebrow">Imported week</p>{weeklyPlans.map((item) => <button className={`week-item ${item === activePlan ? 'is-active' : ''}`} key={`${item.day}-${item.start}`} onClick={() => setActivePlan(item)}><span>{item.day}</span><strong>{hoursToTime(item.start)} - {hoursToTime(item.end)}</strong><small>{item.plan.status === 'rest' ? 'Recovery day' : item.plan.gym.routine.name}</small></button>)}</section>}
      </main>
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import ZbiboCoachEngine from './SchedulerEngine';
import { extractRotaFromImage } from './RotaOCR';
import './styles.css';

const defaultShifts = [
  { day: 'Monday', start: 9, end: 17, demanding: true },
  { day: 'Tuesday', start: 9, end: 17, demanding: false }
];

const defaultTrainingSlots = [
  { id: 1, day: 'Monday', intensity: 'high', name: 'Heavy Lower-Body', details: 'Squats, deadlifts, and heavy leg press', durationMinutes: 90, isRest: false },
  { id: 2, day: 'Wednesday', intensity: 'medium', name: 'Upper-Body Push', details: 'Incline push-ups and tricep extensions', durationMinutes: 60, isRest: false },
  { id: 3, day: 'Friday', intensity: 'low', name: '20-min Kettlebell / Rowing EMOM', details: 'Low-impact conditioning with a controlled pace', durationMinutes: 30, isRest: false },
  { id: 4, day: 'Sunday', intensity: 'rest', name: 'Recovery day', details: 'No training scheduled', durationMinutes: 0, isRest: true }
];

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
  const [trainingSlots, setTrainingSlots] = useState(defaultTrainingSlots);
  const [weeklyPlans, setWeeklyPlans] = useState([]);
  const [activePlan, setActivePlan] = useState(null);
  const [ocrStatus, setOcrStatus] = useState('');
  const [error, setError] = useState('');
  const [showRoutines, setShowRoutines] = useState(true);
  const coach = useMemo(() => new ZbiboCoachEngine(), []);

  const updateTrainingSlot = (id, field, value) => {
    setTrainingSlots((current) => current.map((slot) => slot.id === id
      ? { ...slot, [field]: field === 'durationMinutes' ? Number(value) : value, ...(field === 'intensity' ? { isRest: value === 'rest' } : {}) }
      : slot));
  };

  const addTrainingSlot = () => {
    setTrainingSlots((current) => [...current, {
      id: Date.now(), day: 'New day', intensity: 'medium', name: 'New training session', details: 'Add your exercises', durationMinutes: 45, isRest: false
    }]);
  };

  const removeTrainingSlot = (id) => {
    setTrainingSlots((current) => current.filter((slot) => slot.id !== id));
  };

  const routineForDay = (day) => trainingSlots.find((slot) => slot.day.toLowerCase() === day.toLowerCase()) || trainingSlots.find((slot) => !slot.isRest);

  const handleGenerate = (event) => {
    event.preventDefault();
    try {
      const shift = shiftFromForm(new FormData(event.currentTarget));
      const plans = coach.generateWeeklyPlan([{ ...shift, trainingSlot: routineForDay('Today') }]);
      setShifts([shift]);
      setWeeklyPlans(plans);
      setActivePlan(plans[0]);
      setError('');
    } catch (generationError) {
      setError(generationError.message);
    }
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
      const plans = coach.generateWeeklyPlan(result.shifts.map((shift) => ({ ...shift, trainingSlot: routineForDay(shift.day) })));
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
          {showRoutines && <div className="routine-editor">
            <p className="routine-help">Build as many training or recovery slots as your week needs. Each day can be assigned its own intensity and duration.</p>
            {trainingSlots.map((slot) => (
              <div className="routine-row" key={slot.id}>
                <input aria-label="Training day" value={slot.day} onChange={(event) => updateTrainingSlot(slot.id, 'day', event.target.value)} />
                <select aria-label="Training intensity" value={slot.intensity} onChange={(event) => updateTrainingSlot(slot.id, 'intensity', event.target.value)}>
                  <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="rest">Rest day</option>
                </select>
                <input aria-label="Training name" value={slot.name} onChange={(event) => updateTrainingSlot(slot.id, 'name', event.target.value)} disabled={slot.isRest} />
                <input aria-label="Training duration" type="number" min="0" max="240" step="5" value={slot.durationMinutes} onChange={(event) => updateTrainingSlot(slot.id, 'durationMinutes', event.target.value)} disabled={slot.isRest} />
                <span className="minutes-label">min</span>
                <button className="remove-slot" type="button" aria-label={`Remove ${slot.day} training slot`} onClick={() => removeTrainingSlot(slot.id)}>x</button>
              </div>
            ))}
            <button className="add-slot" type="button" onClick={addTrainingSlot}>+ Add training or rest day</button>
          </div>}
        </section>

        {activePlan && <section className="glass-card result-card active-task-glow">
          <div className="section-heading"><div><p className="eyebrow">03 / Architecture</p><h2>{activePlan.plan.status === 'rest' ? 'Recovery is the plan' : 'Your timeline is ready'}</h2></div><span className="result-mark">{activePlan.plan.status === 'rest' ? 'REST' : 'LIVE'}</span></div>
          {activePlan.plan.status === 'rest' ? <p className="rest-copy">{activePlan.plan.reason} The engine has removed training so your next day can carry less fatigue.</p> : <>
            <div className="metric-strip"><div><span>Energy load</span><strong>{activePlan.plan.energyExpenditure} kcal</strong></div><div><span>Sleep protected</span><strong>8 hours</strong></div><div><span>Routine</span><strong>{activePlan.plan.gym.routine.intensity}</strong></div></div>
            <div className="timeline">{activePlan.plan.timeline.map((item) => <div className="timeline-item" key={`${item.label}-${item.time}`}><span className="timeline-time">{item.time}</span><span className="timeline-line" /><div><strong>{item.label}</strong><span>{item.detail}</span></div></div>)}</div>
          </>}
        </section>}

        {weeklyPlans.length > 0 && <section className="week-list">
          <div className="section-heading"><div><p className="eyebrow">04 / Regenerated week</p><h2>Your schedule, day by day</h2></div><span className="result-mark">{weeklyPlans.length} DAYS</span></div>
          <p className="week-intro">This week was rebuilt from your uploaded rota. Select any day to inspect its complete timeline.</p>
          <div className="week-board">{weeklyPlans.map((item) => <button className={`week-item ${item === activePlan ? 'is-active' : ''}`} key={`${item.day}-${item.start}`} onClick={() => setActivePlan(item)}>
            <span className="week-day">{item.day}</span>
            <strong>{item.plan.status === 'rest' ? 'Recovery day' : `${hoursToTime(item.start)} - ${hoursToTime(item.end)}`}</strong>
            <small>{item.plan.status === 'rest' ? item.plan.reason : item.plan.gym.routine.name}</small>
            <span className={`week-status ${item.plan.status}`}>{item.plan.status === 'rest' ? 'REST' : 'READY'}</span>
          </button>)}</div>
        </section>}
      </main>
    </div>
  );
}

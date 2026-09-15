import React, { useState } from 'react';
import ZbiboCoachEngine from './SchedulerEngine';
import './styles.css';

const coach = new ZbiboCoachEngine();

function timeToHours(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours + minutes / 60;
}

export default function App() {
  const [dailyPlan, setDailyPlan] = useState(null);
  const [error, setError] = useState('');

  const handleGenerate = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      const plan = coach.generateDailyPlan(
        timeToHours(formData.get('workStart')),
        timeToHours(formData.get('workEnd')),
        formData.get('demandingDay') === 'on'
      );
      setDailyPlan(plan);
      setError('');
    } catch (generationError) {
      setDailyPlan(null);
      setError(generationError.message);
    }
  };

  return (
    <div className="app-container">
      <header className="hero">
        <p className="eyebrow">Daily rhythm planner</p>
        <h1 className="header-greeting">Hala, welcome to <span className="highlight">Zbibo Lifestyle</span></h1>
        <p className="hero-copy">Build a realistic routine around your shift, recovery, and training.</p>
      </header>

      <form className="glass-card planner-form" onSubmit={handleGenerate}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Your rota</p>
            <h2>Shape today's architecture</h2>
          </div>
          <span className="status-dot" aria-hidden="true" />
        </div>
        <div className="form-grid">
          <label>
            Shift starts
            <input type="time" name="workStart" defaultValue="09:00" required />
          </label>
          <label>
            Shift ends
            <input type="time" name="workEnd" defaultValue="17:00" required />
          </label>
        </div>
        <label className="checkbox-label">
          <input type="checkbox" name="demandingDay" defaultChecked />
          Tomorrow is a demanding work day
        </label>
        <button type="submit" className="upload-btn">Run Zbibo Engine <span aria-hidden="true">-&gt;</span></button>
        {error && <p className="error-message" role="alert">{error}</p>}
      </form>

      {dailyPlan && (
        <div className="glass-card active-task-glow result-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Your plan</p>
              <h2>Optimized routine</h2>
            </div>
            <span className="result-mark" aria-hidden="true">OK</span>
          </div>
          <div className="schedule-grid">
            <div><span>Sleep</span><strong>{dailyPlan.bedTime}</strong></div>
            <div><span>Wake</span><strong>{dailyPlan.wakeUp}</strong></div>
            <div><span>Gym</span><strong>{dailyPlan.gym.time}</strong></div>
            <div><span>Meal</span><strong>{dailyPlan.mealPrep}</strong></div>
            <div><span>Work starts</span><strong>{dailyPlan.workStart}</strong></div>
          </div>
          <div className="routine-note">
            <strong>{dailyPlan.gym.routine.name}</strong>
            <span>{dailyPlan.gym.routine.details}</span>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import ZbiboCoachEngine from './SchedulerEngine';
import './styles.css';

export default function App() {
  const [dailyPlan, setDailyPlan] = useState(null);
  const coach = new ZbiboCoachEngine();

  const handleGenerate = () => {
    // Example: 9 AM to 5 PM shift, with a demanding day tomorrow
    const plan = coach.generateDailyPlan(9, 17, true);
    setDailyPlan(plan);
  };

  return (
    <div className="app-container">
      <h1 className="header-greeting">Hala, welcome to <span className="highlight">Zbibo Lifestyle</span></h1>
      
      <div className="glass-card">
        <h2>Today's Architecture</h2>
        <p>Upload your work rota to orchestrate your day.</p>
        <button onClick={handleGenerate} className="upload-btn">
          Run Zbibo Engine
        </button>
      </div>

      {dailyPlan && (
        <div className="glass-card active-task-glow" style={{ marginTop: '2rem' }}>
          <h3>Optimized Routine Generated</h3>
          <ul>
            <li><strong>Sleep:</strong> {dailyPlan.bedTime}</li>
            <li><strong>Wake:</strong> {dailyPlan.wakeUp}</li>
            <li><strong>Gym ({dailyPlan.gym.routine.name}):</strong> {dailyPlan.gym.time}</li>
            <li><strong>Post-Workout Meal:</strong> {dailyPlan.mealPrep}</li>
            <li><strong>Work Starts:</strong> {dailyPlan.workStart}</li>
          </ul>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            *Routine selected: {dailyPlan.gym.routine.details}
          </p>
        </div>
      )}
    </div>
  );
}

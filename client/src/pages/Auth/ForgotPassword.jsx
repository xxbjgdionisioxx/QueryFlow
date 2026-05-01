import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import './Auth.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  
  const { forgotPassword, resetPassword } = useAuthStore();
  const { addToast } = useToastStore();
  const navigate = useNavigate();

  useEffect(() => {
    let interval;
    if (showReset && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showReset, timer]);

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newValues = [...otpValues];
    newValues[index] = value.slice(-1);
    setOtpValues(newValues);
    
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').trim().slice(0, 6);
    if (!/^\d+$/.test(pasteData)) return;
    
    const newValues = [...otpValues];
    pasteData.split('').forEach((char, i) => {
      if (i < 6) newValues[i] = char;
    });
    setOtpValues(newValues);
    const nextIdx = Math.min(pasteData.length, 5);
    document.getElementById(`otp-${nextIdx}`)?.focus();
  };

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    const res = await forgotPassword(email);
    if (res.success) {
      addToast(res.message, 'success');
      setShowReset(true);
      setTimer(60);
    } else {
      setError(res.error);
    }
    setIsLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const otp = otpValues.join('');
    if (otp.length < 6) {
      setError('Please enter the 6-digit code.');
      setIsLoading(false);
      return;
    }

    const res = await resetPassword(email, otp, newPassword);
    if (res.success) {
      addToast('Password reset successfully! Please log in.', 'success');
      navigate('/login');
    } else {
      setError(res.error);
    }
    setIsLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass-panel">
        <h1 className="auth-title">Reset Password</h1>
        <p className="auth-subtitle">
          {showReset ? 'Enter the code and your new password.' : 'Enter your email to receive a reset code.'}
        </p>

        {error && (
          <div className="auth-error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        {message && (
          <div className="auth-success">
            <CheckCircle2 size={16} />
            {message}
          </div>
        )}

        {showReset ? (
          <form onSubmit={handleResetPassword} className="auth-form">
            <div className="form-group">
              <label>Verification Code</label>
              <div className="otp-input-container" onPaste={handlePaste}>
                {otpValues.map((val, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    type="text"
                    className="otp-box"
                    value={val}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    maxLength={1}
                    autoComplete="one-time-code"
                    inputMode="numeric"
                  />
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input 
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                required 
                placeholder="••••••••"
                minLength={6}
              />
            </div>
            <button type="submit" className="btn btn-primary auth-submit" disabled={isLoading}>
              {isLoading ? 'Resetting...' : 'Update Password'}
            </button>
            
            <div className="resend-container">
              {timer > 0 ? (
                <span className="resend-timer">Resend code in <b>{timer}s</b></span>
              ) : (
                <button type="button" className="resend-link" onClick={handleRequestReset} disabled={isLoading}>
                  Didn't receive a code? <span>Resend</span>
                </button>
              )}
            </div>
          </form>
        ) : (
          <form onSubmit={handleRequestReset} className="auth-form">
            <div className="form-group">
              <label>Email Address</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                placeholder="you@example.com"
              />
            </div>
            <button type="submit" className="btn btn-primary auth-submit" disabled={isLoading}>
              {isLoading ? 'Sending code...' : 'Send Reset Code'}
            </button>
          </form>
        )}

        <div className="auth-footer">
          Back to <Link to="/login">Log in</Link>
        </div>
      </div>
    </div>
  );
}

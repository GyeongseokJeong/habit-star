"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordInput({
  label = "비밀번호",
  autoComplete = "current-password",
  disabled = false,
}: {
  label?: string;
  autoComplete?: "new-password" | "current-password";
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label htmlFor="account-password">{label}</label>
      <div className="password-input">
        <input
          id="account-password"
          name="password"
          type={visible ? "text" : "password"}
          minLength={8}
          required
          autoComplete={autoComplete}
          disabled={disabled}
          aria-describedby="password-hint"
        />
        <button
          type="button"
          className="icon-button"
          aria-label={visible ? "비밀번호 숨기기" : "비밀번호 표시"}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      <span id="password-hint" className="auth-note">
        8자 이상 입력해주세요.
      </span>
    </div>
  );
}

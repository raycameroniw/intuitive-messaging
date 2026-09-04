"use client";

import { useState } from "react";

export default function UrlForm({ onSubmit, disabled }) {
  const [value, setValue] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    onSubmit(value.trim());
  }

  return (
    <form className="url-form" onSubmit={handleSubmit}>
      <span className="url-form__prefix">https://</span>
      <input
        type="text"
        inputMode="url"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder="yourcompany.com"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        aria-label="Homepage URL"
      />
      <button type="submit" className="btn" disabled={disabled}>
        {disabled ? "Grading…" : "Grade it"}
      </button>
    </form>
  );
}

// components/ConfirmFlagsModal.tsx
import { useState } from 'react'


interface FlagItem {
  key: string
  description: string
  options: string[]
}

interface Props {
  flags: FlagItem[]
  onConfirm: (resolutions: Record<string, string>) => void
  onCancel: () => void
}

export default function ConfirmFlagsModal({ flags, onConfirm, onCancel }: Props) {
  const [resolutions, setResolutions] = useState<Record<string, string>>({})

  const handleChange = (key: string, value: string) => {
    setResolutions(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = () => {
    if (Object.keys(resolutions).length !== flags.length) return
    onConfirm(resolutions)
  }

  return (
    <div className="modal">
      <h2>Resolve Conflicts</h2>
      {flags.map(flag => (
        <div key={flag.key} className="flag">
          <p>{flag.description}</p>
          {flag.options.map(option => (
            <label key={option}>
              <input
                type="radio"
                name={flag.key}
                value={option}
                checked={resolutions[flag.key] === option}
                onChange={() => handleChange(flag.key, option)}
              />
              {option}
            </label>
          ))}
        </div>
      ))}
      <button onClick={handleSubmit} disabled={Object.keys(resolutions).length !== flags.length}>
        Confirm
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  )
}

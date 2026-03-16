import { useState } from 'react'
import StepIndicator from './StepIndicator'
import SetupInstructions from './SetupInstructions'
import PromptStep from './PromptStep'
import ImportStep from './ImportStep'
import PreviewStep from './PreviewStep'

export default function AISetupWizard() {
  const [step, setStep] = useState(1)
  const [importData, setImportData] = useState(null)

  function handleImportSuccess(data) {
    setImportData(data)
    setStep(4)
  }

  return (
    <div>
      <StepIndicator current={step} />

      {step === 1 && (
        <SetupInstructions onNext={() => setStep(2)} />
      )}
      {step === 2 && (
        <PromptStep onNext={() => setStep(3)} onBack={() => setStep(1)} />
      )}
      {step === 3 && (
        <ImportStep onNext={handleImportSuccess} onBack={() => setStep(2)} />
      )}
      {step === 4 && importData && (
        <PreviewStep data={importData} onBack={() => setStep(3)} />
      )}
    </div>
  )
}

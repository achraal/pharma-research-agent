import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './App.css'

const SAMPLE_QUESTIONS = [
  {
    label: 'Warfarin contraindications',
    prompt: 'What are the main contraindications for warfarin?'
  },
  {
    label: 'Warfarin vs apixaban',
    prompt: 'Compare the contraindications of warfarin and apixaban. What conditions are shared and which are unique to each drug?'
  },
  {
    label: 'Warfarin + sertraline',
    prompt: 'A patient currently on warfarin is prescribed sertraline. What is the risk of bleeding and what monitoring is recommended?'
  },
  {
    label: 'Metformin and eGFR 25',
    prompt: 'A patient with an eGFR of 25 mL/min is being considered for metformin. Is metformin contraindicated at this level of renal function, and what is the threshold?'
  }
]

function App() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [currentStep, setCurrentStep] = useState(0) // 0: idle, 1: plan, 2: tools, 3: review, 4: answer
  const [statusText, setStatusText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    const html = document.documentElement
    if (darkMode) {
      html.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      html.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [darkMode])

  const API_BASE = import.meta.env.VITE_API_URL || ''

  const handleCopy = () => {
    if (!answer) return
    navigator.clipboard?.writeText(answer)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleAsk = async (e) => {
    if (e) e.preventDefault()
    if (!question.trim() || loading) return

    setLoading(true)
    setError('')
    setAnswer('')
    setCurrentStep(1)
    setStatusText('Initializing agent pipeline...')

    try {
      const response = await fetch(`${API_BASE}/ask/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      })

      if (!response.ok) {
        throw new Error(`Server error (${response.status})`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.trim()) continue
          const parsed = JSON.parse(line)

          if (parsed.type === 'status') {
            setStatusText(parsed.content)
            if (parsed.content.includes('Plan')) setCurrentStep(1)
            else if (parsed.content.includes('Consultation')) setCurrentStep(2)
            else if (parsed.content.includes('Vérification')) setCurrentStep(3)
          } else if (parsed.type === 'token') {
            setCurrentStep(4)
            setStatusText('')
            setAnswer((prev) => prev + parsed.content)
            await new Promise((r) => setTimeout(r, 15))
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Something went wrong while communicating with the API.')
      setCurrentStep(0)
    } finally {
      setLoading(false)
      setStatusText('')
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-light-surface-container dark:bg-dark-surface text-light-on-surface dark:text-dark-on-surface font-body transition-colors duration-200">
      {/* TOP HEADER */}
      <header className="w-full bg-light-surface dark:bg-dark-surface-container border-b border-light-outline dark:border-dark-outline sticky top-0 z-30 transition-colors duration-200">
        <div className="max-w-[860px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* LOGO: Syntax */}
          <div className="flex items-center gap-3">
            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault()
                setQuestion('')
                setAnswer('')
                setError('')
                setCurrentStep(0)
              }}
              className="flex items-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-accent rounded-lg p-1"
              aria-label="Syntax Home"
            >
              <img
                src="/syntax.webp"
                alt="Syntax Logo"
                className="w-9 h-9 object-contain rounded-lg"
              />
            </a>
          </div>

          {/* RIGHT HEADER CONTROLS */}
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-label font-medium bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" aria-hidden="true" />
              <span>Technical demo</span>
            </span>

            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              aria-label="Toggle light or dark theme"
              className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] w-11 h-11 rounded-md border border-light-outline dark:border-dark-outline bg-light-surface dark:bg-dark-surface text-light-on-surface dark:text-dark-on-surface hover:bg-light-surface-container-high dark:hover:bg-dark-surface-container-high focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">
                {darkMode ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="w-full flex-1 max-w-[860px] mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-8">
        {/* HERO SECTION */}
        <section className="text-center pt-2 sm:pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-light-surface dark:bg-dark-surface-container border border-light-outline/70 dark:border-dark-outline/70 text-xs font-label font-medium text-accent mb-4 shadow-2xs">
            <span className="material-symbols-outlined text-[15px]">verified_user</span>
            <span>FDA Drug Corpus Verified</span>
          </div>
          <h1 className="font-headline text-display-lg-mobile sm:text-display-lg font-semibold tracking-tight text-light-on-surface dark:text-dark-on-surface text-balance">
            Pharma Research Assistant
          </h1>
          <p className="font-body text-body-md sm:text-body-lg text-light-on-surface/75 dark:text-dark-on-surface/75 max-w-xl mx-auto mt-2.5 text-pretty leading-relaxed">
            Plan, retrieve, verify, cite. Answers grounded in FDA drug labels.
          </p>
        </section>

        {/* QUESTION CARD */}
        <section className="bg-light-surface dark:bg-dark-surface-container rounded-md border border-light-outline dark:border-dark-outline p-5 sm:p-6 shadow-sm transition-all focus-within:ring-2 focus-within:ring-accent focus-within:border-accent">
          <form onSubmit={handleAsk} className="flex flex-col gap-4">
            <label htmlFor="question-input" className="sr-only">
              Ask a question about the drug corpus
            </label>

            <div className="relative">
              <textarea
                id="question-input"
                rows="3"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={loading}
                placeholder="Ask a question about the drug corpus..."
                className="w-full p-3.5 bg-light-surface-container dark:bg-dark-surface text-light-on-surface dark:text-dark-on-surface font-body text-body-md rounded-md border border-light-outline/80 dark:border-dark-outline/80 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-all resize-y min-h-[96px] placeholder:text-light-on-surface/40 dark:placeholder:text-dark-on-surface/40 leading-relaxed"
              />
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
              {/* Example Chips Row */}
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Example pharmacology questions">
                <span className="text-xs font-label text-light-on-surface/60 dark:text-dark-on-surface/60 mr-1 hidden sm:inline">
                  Try:
                </span>
                {SAMPLE_QUESTIONS.map((item) => {
                  const isSelected = question === item.prompt
                  return (
                    <button
                      key={item.label}
                      type="button"
                      disabled={loading}
                      onClick={() => setQuestion(item.prompt)}
                      className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-label font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent ${
                        isSelected
                          ? 'bg-teal-50 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-700 text-accent font-semibold'
                          : 'bg-light-surface-container dark:bg-dark-surface border border-light-outline dark:border-dark-outline text-light-on-surface/85 dark:text-dark-on-surface/85 hover:border-accent hover:text-accent dark:hover:text-accent'
                      }`}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </div>

              {/* Primary Ask Button */}
              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={loading || !question.trim()}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-2.5 rounded-md bg-light-primary hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed text-white font-headline text-label-md font-semibold tracking-wide shadow-sm hover:shadow transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 dark:focus:ring-offset-dark-surface w-full sm:w-auto"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Running...</span>
                    </>
                  ) : (
                    <>
                      <span>Ask</span>
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">send</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* LOADING STATE CARD (Shown while agent executes steps 1-3 before tokens arrive) */}
        {loading && !answer && (
          <section className="bg-light-surface dark:bg-dark-surface-container rounded-md border border-light-outline dark:border-dark-outline p-6 shadow-sm">
            <div className="flex items-center gap-3 pb-5 border-b border-light-outline/70 dark:border-dark-outline/70">
              <div className="w-8 h-8 rounded-full bg-accent/10 dark:bg-accent/20 flex items-center justify-center text-accent">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <div>
                <h3 className="font-headline text-body-lg font-semibold text-light-on-surface dark:text-dark-on-surface">
                  Synthesizing Drug Corpus Evidence...
                </h3>
                <p className="text-xs font-body text-light-on-surface/60 dark:text-dark-on-surface/60">
                  {statusText || 'Correlating DailyMed & MedlinePlus labels'}
                </p>
              </div>
            </div>

            <div className="pt-5">
              <div className="text-xs font-label font-medium uppercase tracking-wider text-light-on-surface/50 dark:text-dark-on-surface/50 mb-3">
                Execution pipeline
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Step 1: Planning */}
                <div className={`flex items-center gap-2.5 p-3 rounded-md border ${
                  currentStep > 1
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                    : 'bg-teal-50 dark:bg-teal-950/50 border-teal-300 dark:border-teal-700'
                }`}>
                  <span className={`material-symbols-outlined text-[18px] ${
                    currentStep > 1 ? 'text-success' : 'text-accent animate-pulse'
                  }`}>
                    {currentStep > 1 ? 'check_circle' : 'account_tree'}
                  </span>
                  <div className="flex flex-col">
                    <span className="font-headline text-xs font-semibold text-light-on-surface dark:text-dark-on-surface">
                      1. Planning
                    </span>
                    <span className="text-[11px] font-body text-light-on-surface/70 dark:text-dark-on-surface/70">
                      Decomposing query
                    </span>
                  </div>
                </div>

                {/* Step 2: Searching */}
                <div className={`flex items-center gap-2.5 p-3 rounded-md border ${
                  currentStep > 2
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                    : currentStep === 2
                    ? 'bg-teal-50 dark:bg-teal-950/50 border-teal-300 dark:border-teal-700'
                    : 'bg-light-surface-container dark:bg-dark-surface border-light-outline/70 dark:border-dark-outline/70 opacity-60'
                }`}>
                  <span className={`material-symbols-outlined text-[18px] ${
                    currentStep > 2 ? 'text-success' : currentStep === 2 ? 'text-accent animate-pulse' : 'text-light-on-surface/40'
                  }`}>
                    {currentStep > 2 ? 'check_circle' : currentStep === 2 ? 'radar' : 'hourglass_empty'}
                  </span>
                  <div className="flex flex-col">
                    <span className="font-headline text-xs font-semibold text-light-on-surface dark:text-dark-on-surface">
                      2. Tool Retrieval
                    </span>
                    <span className="text-[11px] font-body text-light-on-surface/70 dark:text-dark-on-surface/70">
                      Corpus &amp; Glossary search
                    </span>
                  </div>
                </div>

                {/* Step 3: Reviewing */}
                <div className={`flex items-center gap-2.5 p-3 rounded-md border ${
                  currentStep === 3
                    ? 'bg-teal-50 dark:bg-teal-950/50 border-teal-300 dark:border-teal-700'
                    : 'bg-light-surface-container dark:bg-dark-surface border-light-outline/70 dark:border-dark-outline/70 opacity-60'
                }`}>
                  <span className={`material-symbols-outlined text-[18px] ${
                    currentStep === 3 ? 'text-accent animate-pulse' : 'text-light-on-surface/40'
                  }`}>
                    {currentStep === 3 ? 'fact_check' : 'hourglass_empty'}
                  </span>
                  <div className="flex flex-col">
                    <span className="font-headline text-xs font-semibold text-light-on-surface dark:text-dark-on-surface">
                      3. Reviewing
                    </span>
                    <span className="text-[11px] font-body text-light-on-surface/70 dark:text-dark-on-surface/70">
                      Clinical critic check
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ERROR STATE ALERT */}
        {error && (
          <section>
            <div
              role="alert"
              className="flex items-center justify-between p-4 rounded-md border border-red-300 dark:border-red-900 bg-error-light dark:bg-red-950/40 text-error dark:text-red-300 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-error text-[22px]" aria-hidden="true">error</span>
                <div>
                  <p className="font-headline text-label-md font-semibold">Corpus Retrieval Error</p>
                  <p className="text-body-md font-body">{error}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAsk}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-label text-label-sm font-semibold bg-white dark:bg-red-900/60 text-error border border-red-200 dark:border-red-800 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-error transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                <span>Retry</span>
              </button>
            </div>
          </section>
        )}

        {/* EMPTY STATE (Shown initially when idle) */}
        {!loading && !answer && !error && (
          <section className="text-center py-12 px-6 bg-light-surface dark:bg-dark-surface-container rounded-md border border-dashed border-light-outline dark:border-dark-outline">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-light-surface-container-high dark:bg-dark-surface-container-high flex items-center justify-center text-accent">
              <span className="material-symbols-outlined text-[30px]">biotech</span>
            </div>
            <h3 className="font-headline text-headline-md font-semibold text-light-on-surface dark:text-dark-on-surface">
              Ready for Pharmacology Inquiries
            </h3>
            <p className="font-body text-body-md text-light-on-surface/70 dark:text-dark-on-surface/70 max-w-md mx-auto mt-2 leading-relaxed">
              Select one of the sample prompt chips above or enter a question regarding drug contraindications, interactions, or dosing protocols.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <span className="text-xs font-label px-3 py-1 rounded-full bg-light-surface-container dark:bg-dark-surface text-light-on-surface/60 dark:text-dark-on-surface/60 border border-light-outline/60 dark:border-dark-outline/60">
                DailyMed Monographs
              </span>
              <span className="text-xs font-label px-3 py-1 rounded-full bg-light-surface-container dark:bg-dark-surface text-light-on-surface/60 dark:text-dark-on-surface/60 border border-light-outline/60 dark:border-dark-outline/60">
                MedlinePlus Consumer Info
              </span>
              <span className="text-xs font-label px-3 py-1 rounded-full bg-light-surface-container dark:bg-dark-surface text-light-on-surface/60 dark:text-dark-on-surface/60 border border-light-outline/60 dark:border-dark-outline/60">
                Clinical Glossary
              </span>
            </div>
          </section>
        )}

        {/* RESULT STATE CONTAINER */}
        {answer && (
          <div className="flex flex-col gap-6">
            {/* ANSWER CARD */}
            <section className="bg-light-surface dark:bg-dark-surface-container rounded-md border border-light-outline dark:border-dark-outline p-6 sm:p-7 shadow-sm">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-light-outline/70 dark:border-dark-outline/70">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-accent text-[22px]">medical_services</span>
                  <h2 className="font-headline text-headline-md font-semibold text-light-on-surface dark:text-dark-on-surface">
                    Answer
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    title="Copy Answer"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-light-surface-container-high dark:hover:bg-dark-surface-container-high text-light-on-surface/70 dark:text-dark-on-surface/70 text-xs font-label transition-colors"
                    aria-label="Copy Answer text"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {copied ? 'check' : 'content_copy'}
                    </span>
                    {copied && <span>Copied</span>}
                  </button>
                  <span className="text-xs font-label px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-accent border border-teal-200 dark:border-teal-800 font-medium">
                    Verified synthesis
                  </span>
                </div>
              </div>

              <div className="markdown-body font-body text-body-md text-light-on-surface/90 dark:text-dark-on-surface/90 leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {answer}
                </ReactMarkdown>
              </div>
            </section>

            {/* DISCLAIMER BANNER */}
            <section className="rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 sm:p-5 text-amber-900 dark:text-amber-200 shadow-sm flex items-start gap-3.5">
              <span className="material-symbols-outlined text-warning text-[24px] flex-shrink-0 mt-0.5" aria-hidden="true">
                warning
              </span>
              <div className="flex-1 text-body-md font-body leading-relaxed">
                <span className="font-semibold">Regulatory Notice:</span> This output is for technical demonstration only and is not medical advice. Clinical decisions must always be made by a licensed healthcare professional reviewing full official drug labeling.
              </div>
            </section>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="w-full bg-light-surface dark:bg-dark-surface-container border-t border-light-outline dark:border-dark-outline py-6 text-center transition-colors duration-200">
        <div className="max-w-[860px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-body text-light-on-surface/60 dark:text-dark-on-surface/60">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent" />
            <span>Syntax BioIntelligence Platform</span>
          </div>
          <p>© Syntax. Technical exercise.</p>
          <div className="flex items-center gap-4">
            <a href={`${API_BASE}/health`} target="_blank" rel="noreferrer" className="hover:text-accent transition-colors">
              API Health
            </a>
            <a href={`${API_BASE}/docs`} target="_blank" rel="noreferrer" className="hover:text-accent transition-colors">
              Swagger Docs
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
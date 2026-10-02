import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import mermaid from 'mermaid'
import { Network } from 'lucide-react'
import Spinner from '../ui/Spinner'

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  securityLevel: 'loose',
  themeVariables: {
    darkMode: false,
    background: '#ffffff',
    primaryColor: '#eef1ff',
    primaryTextColor: '#0f1630',
    primaryBorderColor: '#3b5bfd',
    lineColor: '#6b7fd6',
    secondaryColor: '#f2f4fa',
    tertiaryColor: '#f7f8fc',
    fontFamily: 'Geist, sans-serif',
  },
})

function MermaidBlock({ code }) {
  const [svg, setSvg] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    let isMounted = true
    const cleanCode = (code || '').trim()
    if (!cleanCode) return

    const renderId = 'mmd-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now()

    const timer = setTimeout(() => {
      if (isMounted) {
        console.warn('Mermaid render timed out, falling back to code preview')
        setError(true)
      }
    }, 2500)

    try {
      mermaid.render(renderId, cleanCode)
        .then(({ svg: renderedSvg }) => {
          if (isMounted) {
            clearTimeout(timer)
            setSvg(renderedSvg)
            setError(false)
          }
        })
        .catch((err) => {
          console.warn('Mermaid render error:', err)
          if (isMounted) {
            clearTimeout(timer)
            setError(true)
          }
        })
        .finally(() => {
          const el = document.getElementById(renderId)
          if (el) el.remove()
        })
    } catch (err) {
      console.warn('Mermaid synchronous error:', err)
      if (isMounted) {
        clearTimeout(timer)
        setError(true)
      }
    }

    return () => {
      isMounted = false
      clearTimeout(timer)
      const el = document.getElementById(renderId)
      if (el) el.remove()
    }
  }, [code])

  const header = (label) => (
    <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 font-mono text-[11px] tracking-wide text-dim uppercase">
      <Network size={13} className="text-accent" /> {label}
    </div>
  )

  if (error) {
    return (
      <div className="not-prose overflow-hidden rounded-xl border border-line bg-rail">
        {header('Mermaid Diagram (Syntax Preview)')}
        <pre className="!m-0 !rounded-none !border-0"><code>{code}</code></pre>
      </div>
    )
  }

  if (!svg) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-line bg-rail px-4 py-3 text-sm text-dim">
        <Spinner />
        <span>Rendering interactive diagram...</span>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-rail">
      {header('Interactive Mermaid Diagram')}
      <div className="mermaid-svg overflow-x-auto p-4" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  )
}

function preprocessLaTeX(content) {
  if (!content) return ''
  // Convert display math \[ ... \] to $$ ... $$
  let processed = content.replace(/\\\[([\s\S]*?)\\\]/g, (_match, eq) => `$$\n${eq.trim()}\n$$`)
  // Convert inline math \( ... \) to $ ... $
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_match, eq) => `$${eq.trim()}$`)
  return processed
}

export default function Markdown({ content }) {
  if (!content) return null
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const codeText = String(children || '').replace(/\n$/, '')
            const match = /language-(\w+)/.exec(className || '')
            const isMermaid = (match && match[1] === 'mermaid') || (!inline && /^\s*(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph)\b/.test(codeText))
            if (!inline && isMermaid) {
              return <MermaidBlock code={codeText} />
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            )
          },
        }}
      >
        {preprocessLaTeX(content)}
      </ReactMarkdown>
    </div>
  )
}

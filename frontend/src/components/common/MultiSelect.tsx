import { Fragment, useState, useEffect, useRef } from 'react'
import { Listbox, Transition } from '@headlessui/react'
import { Check, ChevronDown, X } from 'lucide-react'

interface Option {
  value: string | number
  label: string
}

interface MultiSelectProps {
  label?: string
  value: (string | number)[]
  onChange: (value: (string | number)[]) => void
  options: Option[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

export default function MultiSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  className = ''
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const selectedOptions = options.filter(opt => value.includes(opt.value))

  const toggleOption = (optionValue: string | number) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue))
    } else {
      onChange([...value, optionValue])
    }
  }

  const handleSelectAll = () => {
    if (value.length === options.length) {
      onChange([])
    } else {
      onChange(options.map(opt => opt.value))
    }
  }

  const removeOption = (optionValue: string | number, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(value.filter(v => v !== optionValue))
  }

  const displayText = selectedOptions.length === 0
    ? placeholder
    : selectedOptions.length === 1
    ? selectedOptions[0].label
    : `${selectedOptions.length} selected`

  return (
    <div className={`${className} ${!label ? 'h-10' : ''}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <Listbox value={value} onChange={() => {}} disabled={disabled} as="div">
        <div className="relative">
          <Listbox.Button
            onClick={() => setIsOpen(!isOpen)}
            className="relative w-full px-3 h-10 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189] cursor-pointer text-left disabled:bg-gray-100 disabled:cursor-not-allowed transition-all flex items-center"
          >
            <div className="flex-1 flex items-center gap-2 flex-wrap">
              {selectedOptions.length === 0 ? (
                <span className="text-gray-500">{placeholder}</span>
              ) : selectedOptions.length <= 2 ? (
                selectedOptions.map(opt => (
                  <span
                    key={opt.value}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#405189]/10 text-[#405189] rounded text-sm"
                  >
                    {opt.label}
                    <button
                      type="button"
                      onClick={(e) => removeOption(opt.value, e)}
                      className="hover:bg-[#405189]/20 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              ) : (
                <>
                  {selectedOptions.slice(0, 2).map(opt => (
                    <span
                      key={opt.value}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#405189]/10 text-[#405189] rounded text-sm"
                    >
                      {opt.label}
                      <button
                        type="button"
                        onClick={(e) => removeOption(opt.value, e)}
                        className="hover:bg-[#405189]/20 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <span className="text-sm text-gray-600">
                    +{selectedOptions.length - 2} more
                  </span>
                </>
              )}
            </div>
            <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </Listbox.Button>
          <Transition
            show={isOpen}
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="absolute z-[10] mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
              <div className="p-2 border-b border-gray-200">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="w-full text-left px-2 py-1.5 text-sm text-[#405189] hover:bg-[#405189]/10 rounded transition-colors"
                >
                  {value.length === options.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              {options.map((option) => {
                const isSelected = value.includes(option.value)
                return (
                  <div
                    key={option.value}
                    onClick={() => toggleOption(option.value)}
                    className={`relative cursor-pointer select-none py-2 pl-10 pr-4 transition-colors ${
                      isSelected ? 'bg-[#405189]/10 text-[#405189]' : 'hover:bg-gray-50 text-gray-900'
                    }`}
                  >
                    <span className={`block truncate text-sm ${isSelected ? 'font-medium' : 'font-normal'}`}>
                      {option.label}
                    </span>
                    {isSelected && (
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#405189]">
                        <Check className="w-4 h-4" />
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </Transition>
        </div>
      </Listbox>
    </div>
  )
}

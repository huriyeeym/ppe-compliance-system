import { Fragment } from 'react'
import { Listbox, Transition } from '@headlessui/react'
import { Check, ChevronDown } from 'lucide-react'

interface Option {
  value: string | number
  label: string
}

interface CustomSelectProps {
  label?: string
  value: string | number | null | undefined
  onChange: (value: any) => void
  options: Option[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

export default function CustomSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  className = ''
}: CustomSelectProps) {
  const selectedOption = options.find(opt => {
    // Handle type conversion for comparison
    const optValue = String(opt.value)
    const currentValue = value === null || value === undefined ? '' : String(value)
    return optValue === currentValue
  })

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <Listbox value={value} onChange={onChange} disabled={disabled}>
        <div className="relative">
          <Listbox.Button className="relative w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189] cursor-pointer text-left disabled:bg-gray-100 disabled:cursor-not-allowed transition-all">
            <span className="block truncate">
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </Listbox.Button>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
              {options.map((option) => (
                <Listbox.Option
                  key={option.value}
                  value={option.value}
                  className={({ active }) =>
                    `relative cursor-pointer select-none py-2 pl-10 pr-4 transition-colors ${
                      active ? 'bg-[#405189]/10 text-[#405189]' : 'text-gray-900'
                    }`
                  }
                >
                  {({ selected }) => (
                    <>
                      <span className={`block truncate text-sm ${selected ? 'font-medium' : 'font-normal'}`}>
                        {option.label}
                      </span>
                      {selected && (
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#405189]">
                          <Check className="w-4 h-4" />
                        </span>
                      )}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
    </div>
  )
}

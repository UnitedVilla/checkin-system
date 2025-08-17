'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Step = {
  id: string;
  title: string;
  status: 'completed' | 'active' | 'inactive';
};

type StepProgressProps = {
  currentStep: number;
};

const StepProgress = ({ currentStep }: StepProgressProps) => {
  const t = useTranslations();

  const steps: Step[] = [
    {
      id: 'search',
      title: t('search.title'),
      status: currentStep > 1 ? 'completed' : currentStep === 1 ? 'active' : 'inactive'
    },
    {
      id: 'select',
      title: t('select.title'),
      status: currentStep > 2 ? 'completed' : currentStep === 2 ? 'active' : 'inactive'
    },
    {
      id: 'upload',
      title: t('upload.title'),
      status: currentStep > 3 ? 'completed' : currentStep === 3 ? 'active' : 'inactive'
    },
    {
      id: 'result',
      title: t('result.title'),
      status: currentStep > 4 ? 'completed' : currentStep === 4 ? 'active' : 'inactive'
    }
  ];

  return (
    <div className="w-full py-6">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              {/* ステップアイコン */}
              <div className="flex flex-col items-center">
                <motion.div
                  className={`step-indicator ${step.status}`}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ 
                    duration: 0.3,
                    delay: index * 0.1 
                  }}
                >
                  {step.status === 'completed' ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Check size={16} />
                    </motion.div>
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </motion.div>
                
                <motion.span
                  className={`mt-2 text-xs sm:text-sm font-medium text-center ${
                    step.status === 'active' 
                      ? 'text-wa-primary-600' 
                      : step.status === 'completed'
                      ? 'text-wa-accent-600'
                      : 'text-wa-neutral-400'
                  }`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ 
                    duration: 0.3,
                    delay: index * 0.1 + 0.2 
                  }}
                >
                  {step.title}
                </motion.span>
              </div>

              {/* 接続線 */}
              {index < steps.length - 1 && (
                <div className="flex-1 mx-4 h-0.5 bg-wa-neutral-200 relative overflow-hidden">
                  <motion.div
                    className="absolute top-0 left-0 h-full bg-wa-primary-400"
                    initial={{ width: '0%' }}
                    animate={{ 
                      width: currentStep > index + 1 ? '100%' : '0%' 
                    }}
                    transition={{ 
                      duration: 0.8,
                      delay: index * 0.2,
                      ease: "easeInOut"
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StepProgress;
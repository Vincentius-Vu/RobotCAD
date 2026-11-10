import { useRobotStore } from '../store/robotStore';
import { enTranslations } from './locales/en';
import { viTranslations } from './locales/vi';
import { TranslationDictionary } from './types';

export const useTranslation = () => {
  const language = useRobotStore((state) => state.language);
  const setLanguage = useRobotStore((state) => state.setLanguage);
  const toggleLanguage = useRobotStore((state) => state.toggleLanguage);

  const t: TranslationDictionary = language === 'vi' ? viTranslations : enTranslations;

  return {
    t,
    language,
    setLanguage,
    toggleLanguage,
    isEn: language === 'en',
    isVi: language === 'vi',
  };
};

export default useTranslation;

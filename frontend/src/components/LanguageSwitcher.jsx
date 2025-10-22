import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher = () => {
    const { i18n } = useTranslation();

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
    };

    return (
        <div className="language-switcher">
            <button
                onClick={() => changeLanguage('sk')}
                className={`language-switcher-btn ${i18n.language === 'sk' ? 'active' : 'inactive'}`}
            >
                🇸🇰 SK
            </button>
            <button
                onClick={() => changeLanguage('en')}
                className={`language-switcher-btn ${i18n.language === 'en' ? 'active' : 'inactive'}`}
            >
                🇺🇸 EN
            </button>
        </div>
    );
};

export default LanguageSwitcher;
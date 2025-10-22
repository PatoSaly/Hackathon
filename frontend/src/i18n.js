import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Preklady
const resources = {
  sk: {
    translation: {
      // Hlavný nadpis
      "title": "Jednoduchý Elektronický Podpis (JEP) - Prototype",
      "status": "Stav",
      
      // Tabu navigácia
      "tabs": {
        "upload": "📄 Upload & Detaily",
        "sign": "✍️ Podpis",
        "approvers": "👥 Schvaľovatelia",
        "approval_status": "📊 Stav schválenia",
        "all_documents": "📋 Všetky dokumenty",
        "admin_approvers": "⚙️ Admin schvaľovateľov"
      },
      
      // Tab 1 - Upload
      "upload": {
        "title": "📄 Upload & Detaily dokumentu",
        "document_uploaded": "Dokument ID: {{id}} je už nahraný!",
        "new_document": "Nový dokument",
        "new_case": "Začať nový prípad",
        "case_resolved": "Tento prípad je vyriešený!",
        "start_new_case": "Môžete začať nový prípad pre ďalšie dokumenty.",
        "new_case_info": "Môžete nahrať nový dokument pre vytvorenie nového prípadu. Každý prípad dostane jedinečné ID.",
        "file_label": "Súbor PDF:",
        "choose_file": "Vybrať súbor",
        "no_file_selected": "Žiadny súbor nevybraný",
        "case_id_label": "ID prípadu (automaticky generované):",
        "case_id_help": "ID prípadu sa generuje automaticky vo formáte 6-ciferného čísla",
        "comment_label": "Komentár:",
        "comment_placeholder": "Voliteľný komentár k dokumentu",
        "upload_button": "📤 Upload a Uložiť",
        "uploading": "Nahrávam...",
        "file_required": "Súbor je povinný!",
        "upload_success": "Úspešne nahrané! ID prípadu: {{caseId}}. Prejdite na podpis.",
        "upload_error": "Chyba pri nahrávaní: {{error}}"
      },
      
      // Tab 2 - Podpis
      "sign": {
        "title": "✍️ Elektronický podpis dokumentu",
        "document_id": "ID prípadu:",
        "description": "Kliknutím na tlačidlo pridáte elektronický podpis a uzamknete dokument pre ďalšie úpravy.",
        "sign_button": "✍️ Pridať podpis a uzamknúť",
        "already_signed": "⚠️ Dokument je už podpísaný a uzamknutý.",
        "upload_first": "⚠️ Najprv nahrajte dokument v prvom kroku.",
        "signing": "Podpisujem dokument..."
      },
      
      // Tab 3 - Schvaľovatelia
      "approvers": {
        "title": "👥 Správa schvaľovateľov",
        "email_label": "Email adresy schvaľovateľov:",
        "email_placeholder": "Zadajte email adresy schvaľovateľov (každý na nový riadok alebo oddelené čiarkou)",
        "add_button": "👥 Pridať schvaľovateľov a spustiť schvaľovanie",
        "dynamic_title": "🎯 Výber zo zoznamu:",
        "add_approver": "Pridať schvaľovateľa",
        "add_row": "Pridať ďalšieho schvaľovateľa",
        "manual_title": "✏️ Manuálne zadanie:",
        "simulation_title": "🔗 Simulácia Schválenia:",
        "approve_button": "✅ Approve",
        "disapprove_button": "❌ Disapprove",
        "adding": "Pridávam schvaľovateľov...",
        "simulation_completed": "✅ Simulácia schválenia bola dokončená. Pozrite si stav dokumentu v záložke História.",
        "all_completed": "✅ Všetci schvaľovatelia dokončili proces.",
        "approval_in_progress": "Prebieha schvaľovací proces. Upravovanie schvaľovateľov je dočasne zakázané.",
        "upload_first": "⚠️ Najprv nahrajte dokument v prvom kroku."
      },
      
      // Tab 4 - História
      "history": {
        "title": "📊 História a stav dokumentu",
        "refresh_button": "🔄 Obnoviť Status/Históriu",
        "refresh_success": "Zobrazený stav dokumentu ID prípadu: {{id}}.",
        "refresh_error": "Chyba pri získavaní histórie: {{error}}",
        "case_id": "ID prípadu:",
        "status": "Status:",
        "basic_info": "📋 Základné informácie:",
        "original_filename": "Pôvodný názov súboru:",
        "comment": "Komentár:",
        "no_comment": "Žiadny komentár",
        "uploaded": "Nahrané:",
        "signed": "Podpísané:",
        "timeline": "⏰ Časová os procesu:",
        "timeline_upload": "1. Upload dokumentu",
        "timeline_sign": "2. Elektronický podpis",
        "timeline_approval": "3. Proces schvaľovania",
        "approvers_added": "Pridaní schvaľovatelia: {{count}}",
        "file_section": "📎 Súbor:",
        "view_download": "📄 Zobraziť/Stiahnuť dokument ({{filename}})",
        "approvers_history": "👥 História Schvaľovateľov ({{count}}):",
        "approver_number": "Schvaľovateľ #{{number}}",
        "summary": "📊 Súhrn:",
        "approved": "✅ Schválené:",
        "rejected": "❌ Zamietnuté:",
        "pending": "⏳ Čakajúce:",
        "simulation_title": "🔗 Simulácia Schválenia (Testovací režim):",
        "simulation_description": "Simulujte schvaľovanie emailom - v reálnom prostredí by schvaľovatelia dostali email s linkom.",
        "approve_button": "✅ Schváliť",
        "reject_button": "❌ Zamietnuť",
        "upload_first": "⚠️ Najprv nahrajte dokument v prvom kroku."
      },
      
      // Tab 5 - Všetky dokumenty
      "all_documents": {
        "title": "📋 Prehľad všetkých dokumentov v systéme",
        "load_button": "🔄 Načítať všetky dokumenty",
        "reset_button": "🗑️ Vymazať všetky dáta",
        "approved": "✅ Schválené:",
        "rejected": "❌ Zamietnuté:",
        "waiting": "⏳ Čakajúce:",
        "draft": "📝 Draft:",
        "file": "Súbor:",
        "uploaded": "Nahrané:",
        "signed": "Podpísané:",
        "comment": "Komentár:",
        "approvers": "👥 Schvaľovatelia:",
        "view_detail": "👁️ Zobraziť detail",
        "total_documents": "Celkovo dokumentov v systéme:",
        "reset_confirm": "Naozaj chcete vymazať všetky dáta z databázy? Táto akcia sa nedá vrátiť späť.",
        "reset_success": "Databáza bola úspešne vyčistená.",
        "reset_error": "Chyba pri čistení databázy: {{error}}",
        "load_success": "Načítaný zoznam dokumentov: {{count}} dokumentov.",
        "load_error": "Chyba pri načítavaní dokumentov: {{error}}"
      },
      
      // Statusy dokumentov
      "statuses": {
        "Draft": "Draft",
        "Waiting for Approval": "Čaká na schválenie",
        "Final Approved": "Finálne schválené",
        "Rejected": "Zamietnuté",
        "Approved": "Schválené",
        "Pending": "Čakajúce"
      },
      
      // Všeobecné
      "general": {
        "loading": "Načítavam...",
        "error": "Chyba",
        "success": "Úspech",
        "cancel": "Zrušiť",
        "confirm": "Potvrdiť",
        "close": "Zavrieť"
      },
      
      // Administrácia schvaľovateľov
      "admin": {
        "title": "⚙️ Administrácia schvaľovateľov",
        "add_new": "Pridať nového schvaľovateľa",
        "add_title": "Pridať nového schvaľovateľa",
        "edit_title": "Upraviť schvaľovateľa",
        "name": "Meno",
        "email": "Email",
        "department": "Oddelenie",
        "active": "Aktívny",
        "status": "Stav",
        "actions": "Akcie",
        "active_status": "Aktívny",
        "inactive_status": "Neaktívny",
        "add": "Pridať",
        "update": "Aktualizovať",
        "edit": "Upraviť",
        "delete": "Zmazať",
        "activate": "Aktivovať",
        "deactivate": "Deaktivovať",
        "cancel": "Zrušiť",
        "loading": "Načítavam schvaľovateľov...",
        "confirm_change_during_approval": "UPOZORNENIE: Dokument je momentálne v procese schvaľovania. Naozaj chcete pokračovať so zmenou v zozname schvaľovateľov? Toto môže ovplyvniť prebiehajúci proces.",
        "cannot_modify_during_approval": "🚫 CHYBA: Nemožno upravovať zoznam schvaľovateľov počas procesu schvaľovania alebo po jeho dokončení. Dokument je uzamknutý."
      },
      
      // Dodatočné správy
      "messages": {
        "approval_action_success": "Akcia {{action}} pre schvaľovateľa {{approverId}} bola spracovaná.",
        "approval_action_error": "Chyba pri akcii {{action}}."
      }
    }
  },
  en: {
    translation: {
      // Main title
      "title": "Simple Electronic Signature (SES) - Prototype",
      "status": "Status",
      
      // Tab navigation
      "tabs": {
        "upload": "📄 Upload & Details",
        "sign": "✍️ Signature", 
        "approvers": "👥 Approvers",
        "approval_status": "📊 Approval Status",
        "all_documents": "📋 All Documents",
        "admin_approvers": "⚙️ Admin Approvers"
      },
      
      // Tab 1 - Upload
      "upload": {
        "title": "📄 Document Upload & Details",
        "document_uploaded": "Document ID: {{id}} is already uploaded!",
        "new_document": "New document",
        "new_case": "Start new case",
        "case_resolved": "This case is resolved!",
        "start_new_case": "You can start a new case for additional documents.",
        "new_case_info": "You can upload a new document to create a new case. Each case receives a unique ID.",
        "file_label": "PDF File:",
        "choose_file": "Choose File",
        "no_file_selected": "No file selected",
        "case_id_label": "Case ID (automatically generated):",
        "case_id_help": "Case ID is automatically generated in 6-digit number format",
        "comment_label": "Comment:",
        "comment_placeholder": "Optional comment for the document",
        "upload_button": "📤 Upload and Save",
        "uploading": "Uploading...",
        "file_required": "File is required!",
        "upload_success": "Successfully uploaded! Case ID: {{caseId}}. Proceed to signature.",
        "upload_error": "Upload error: {{error}}"
      },
      
      // Tab 2 - Sign
      "sign": {
        "title": "✍️ Electronic Document Signature",
        "document_id": "Case ID:",
        "description": "Click the button to add electronic signature and lock the document for further modifications.",
        "sign_button": "✍️ Add signature and lock",
        "already_signed": "⚠️ Document is already signed and locked.",
        "upload_first": "⚠️ Please upload document in the first step.",
        "signing": "Signing document..."
      },
      
      // Tab 3 - Approvers
      "approvers": {
        "title": "👥 Approvers Management",
        "email_label": "Approver email addresses:",
        "email_placeholder": "Enter approver email addresses (each on new line or comma separated)",
        "add_button": "👥 Add approvers and start approval process",
        "dynamic_title": "🎯 Select from list:",
        "add_approver": "Add Approver",
        "add_row": "Add Another Approver",
        "manual_title": "✏️ Manual Entry:",
        "simulation_title": "🔗 Approval Simulation:",
        "approve_button": "✅ Approve",
        "disapprove_button": "❌ Disapprove",
        "adding": "Adding approvers...",
        "simulation_completed": "✅ Approval simulation completed. Check document status in History tab.",
        "all_completed": "✅ All approvers have completed the process.",
        "approval_in_progress": "Approval process is in progress. Editing approvers is temporarily disabled.",
        "upload_first": "⚠️ Please upload document in the first step."
      },
      
      // Tab 4 - History
      "history": {
        "title": "📊 Document History and Status",
        "refresh_button": "🔄 Refresh Status/History",
        "refresh_success": "Displayed document status Case ID: {{id}}.",
        "refresh_error": "Error getting history: {{error}}",
        "case_id": "Case ID:",
        "status": "Status:",
        "basic_info": "📋 Basic Information:",
        "original_filename": "Original filename:",
        "comment": "Comment:",
        "no_comment": "No comment",
        "uploaded": "Uploaded:",
        "signed": "Signed:",
        "timeline": "⏰ Process Timeline:",
        "timeline_upload": "1. Document upload",
        "timeline_sign": "2. Electronic signature",
        "timeline_approval": "3. Approval process",
        "approvers_added": "Added approvers: {{count}}",
        "file_section": "📎 File:",
        "view_download": "📄 View/Download document ({{filename}})",
        "approvers_history": "👥 Approvers History ({{count}}):",
        "approver_number": "Approver #{{number}}",
        "summary": "📊 Summary:",
        "approved": "✅ Approved:",
        "rejected": "❌ Rejected:",
        "pending": "⏳ Pending:",
        "simulation_title": "🔗 Approval Simulation (Test Mode):",
        "simulation_description": "Simulate email approval - in real environment, approvers would receive email with link.",
        "approve_button": "✅ Approve",
        "reject_button": "❌ Reject",
        "upload_first": "⚠️ Please upload document in the first step."
      },
      
      // Tab 5 - All documents
      "all_documents": {
        "title": "📋 Overview of All Documents in System",
        "load_button": "🔄 Load All Documents",
        "reset_button": "🗑️ Delete All Data",
        "approved": "✅ Approved:",
        "rejected": "❌ Rejected:",
        "waiting": "⏳ Waiting:",
        "draft": "📝 Draft:",
        "file": "File:",
        "uploaded": "Uploaded:",
        "signed": "Signed:",
        "comment": "Comment:",
        "approvers": "👥 Approvers:",
        "view_detail": "👁️ View Details",
        "total_documents": "Total documents in system:",
        "reset_confirm": "Do you really want to delete all data from database? This action cannot be undone.",
        "reset_success": "Database was successfully cleared.",
        "reset_error": "Error clearing database: {{error}}",
        "load_success": "Loaded document list: {{count}} documents.",
        "load_error": "Error loading documents: {{error}}"
      },
      
      // Document statuses
      "statuses": {
        "Draft": "Draft",
        "Waiting for Approval": "Waiting for Approval",
        "Final Approved": "Final Approved", 
        "Rejected": "Rejected",
        "Approved": "Approved",
        "Pending": "Pending"
      },
      
      // General
      "general": {
        "loading": "Loading...",
        "error": "Error",
        "success": "Success",
        "cancel": "Cancel",
        "confirm": "Confirm",
        "close": "Close"
      },
      
      // Admin Approvers
      "admin": {
        "title": "⚙️ Approvers Administration",
        "add_new": "Add New Approver",
        "add_title": "Add New Approver",
        "edit_title": "Edit Approver",
        "name": "Name",
        "email": "Email",
        "department": "Department",
        "active": "Active",
        "status": "Status",
        "actions": "Actions",
        "active_status": "Active",
        "inactive_status": "Inactive",
        "add": "Add",
        "update": "Update",
        "edit": "Edit",
        "delete": "Delete",
        "activate": "Activate",
        "deactivate": "Deactivate",
        "cancel": "Cancel",
        "loading": "Loading approvers...",
        "confirm_change_during_approval": "WARNING: Document is currently in approval process. Are you sure you want to continue with changes to the approvers list? This may affect the ongoing process.",
        "cannot_modify_during_approval": "🚫 ERROR: Cannot modify approvers list during approval process or after completion. Document is locked."
      },
      
      // Additional messages
      "messages": {
        "approval_action_success": "Action {{action}} for approver {{approverId}} was processed.",
        "approval_action_error": "Error with action {{action}}."
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'sk', // predvolený jazyk
    fallbackLng: 'sk',
    interpolation: {
      escapeValue: false // React už escapuje automaticky
    }
  });

export default i18n;
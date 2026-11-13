import { useState } from "react";
import { useI18n } from "../i18n";
import {
  MobileButton,
  MobileComposer,
  MobileIconButton,
  MobileListRow,
  MobileMessage,
  MobilePageHeader,
  MobileSection,
  MobileSegmentedControl,
  MobileSidebar,
  MobileSidebarChildRow,
  MobileSidebarEntryRow,
  MobileSidebarHeader,
  MobileSidebarSectionLabel,
  MobileSidebarSessionRow,
  MobileSidebarToolsFooter,
  MobileSidebarWorkspaceRow,
  MobileStatus,
  MobileSwitch,
  MobileTabBar,
  MobileTextField,
  MobileToolbar,
} from "@openbitfun/ui/mobile";
import { Icon } from "@openbitfun/ui";
import { ThemeRoot, type ColorScheme, type ContrastMode, type DensityMode, type TokenOverrides } from "@openbitfun/ui";

interface MobileSceneGalleryProps {
  colorScheme: ColorScheme;
  contrast: ContrastMode;
  density: DensityMode;
  tokenOverrides: TokenOverrides;
}

export function MobileSceneGallery({ colorScheme, contrast, density, tokenOverrides }: MobileSceneGalleryProps) {
  const { t } = useI18n();
  const theme = { colorScheme, contrast, density, tokenOverrides };
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Record<string, boolean>>({
    [t("scenes.mobile.sidebar.workspace1")]: true,
  });

  const toggleWorkspace = (name: string) =>
    setExpandedWorkspaces((current) => ({ ...current, [name]: !current[name] }));

  const workspaceNames = [
    t("scenes.mobile.sidebar.workspace1"),
    t("scenes.mobile.sidebar.workspace2"),
    t("scenes.mobile.sidebar.workspace3"),
  ];

  return (
    <div className="design-mobile-scenes" role="img" aria-label={t("scenes.mobile.label")}>
      {/* Scene 1: Chat */}
      <ThemeRoot className="design-phone-frame" {...theme}>
        <div className="design-phone-screen">
          <div className="design-phone-status"><span>9:41</span><span>●●●</span></div>
          <MobileToolbar title={t("scenes.mobile.chat.title")} leading={<MobileIconButton icon={<Icon name="chevron-left" />} aria-label={t("scenes.back")} />} trailing={<MobileIconButton icon={<Icon name="more" />} aria-label={t("scenes.more")} />} />
          <div className="design-phone-thread">
            <MobileMessage roleType="user">{t("scenes.mobile.chat.messageUser")}</MobileMessage>
            <MobileMessage roleType="assistant">{t("scenes.mobile.chat.messageAssistant")}</MobileMessage>
            <MobileMessage roleType="system">{t("scenes.mobile.chat.messageSystem")}</MobileMessage>
          </div>
          <MobileComposer aria-label={t("scenes.mobile.chat.placeholder")}>
            <span className="design-home-preview-placeholder">{t("scenes.mobile.chat.placeholder")}</span>
          </MobileComposer>
          <div className="design-phone-gesture" />
        </div>
      </ThemeRoot>

      {/* Scene 2: Sidebar */}
      <ThemeRoot className="design-phone-frame" {...theme}>
        <div className="design-phone-screen design-mobile-sidebar-scene" data-color-scheme={colorScheme}>
          <div className="design-phone-status"><span>9:41</span><span>●●●</span></div>
          <MobileSidebar
            header={
              <MobileSidebarHeader
                brand={t("scenes.mobile.sidebar.brand")}
                trailing={
                  <>
                    <MobileIconButton icon={<Icon name="search" />} aria-label={t("scenes.mobile.sidebar.search")} />
                    <MobileIconButton icon={<Icon name="sidebar-left" />} aria-label={t("scenes.mobile.sidebar.collapse")} />
                  </>
                }
              />
            }
            footer={
              <MobileSidebarToolsFooter
                leading={t("scenes.mobile.sidebar.tools")}
                onSettingsClick={() => undefined}
                onToolsClick={() => undefined}
                settingsLabel={t("scenes.mobile.sidebar.settings")}
              />
            }
          >
            <div className="design-mobile-sidebar-scroll">
              <MobileSidebarEntryRow
                icon={<img src="/assets/bitfun-mascot.svg" alt="" draggable={false} />}
                label={t("scenes.mobile.sidebar.assistant")}
              />
              <MobileSidebarEntryRow
                icon={(
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <rect x="3.2" y="3.2" width="7.6" height="7.6" rx="2.2" />
                    <circle cx="17" cy="7" r="3.8" />
                    <rect x="3.2" y="13.2" width="7.6" height="7.6" rx="3.8" />
                    <circle cx="17" cy="17" r="3.8" />
                  </svg>
                )}
                label={t("scenes.mobile.sidebar.miniApps")}
              />
              <MobileSidebarSectionLabel
                action={(
                  <button type="button" aria-label={t("scenes.mobile.sidebar.addWorkspace")} className="design-mobile-sidebar-add">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                )}
              >
                {t("scenes.mobile.sidebar.workspace")}
              </MobileSidebarSectionLabel>
              {workspaceNames.map((name) => (
                <MobileSidebarWorkspaceRow
                  key={name}
                  expanded={Boolean(expandedWorkspaces[name])}
                  label={name}
                  onExpandChange={() => toggleWorkspace(name)}
                >
                  <MobileSidebarChildRow label={t("scenes.mobile.sidebar.childRemote")} />
                  <MobileSidebarChildRow label={t("scenes.mobile.sidebar.childLocal")} />
                </MobileSidebarWorkspaceRow>
              ))}
              <MobileSidebarSectionLabel>{t("scenes.mobile.sidebar.recent")}</MobileSidebarSectionLabel>
              <MobileSidebarSessionRow label={t("scenes.mobile.sidebar.session1")} status="running" time="2m" />
              <MobileSidebarSessionRow label={t("scenes.mobile.sidebar.session2")} time="1h" />
              <MobileSidebarSessionRow label={t("scenes.mobile.sidebar.session3")} time="3h" />
              <MobileSidebarSessionRow label={t("scenes.mobile.sidebar.session4")} status="error" time="1d" />
              <MobileSidebarSessionRow label={t("scenes.mobile.sidebar.session5")} time="2d" selected />
            </div>
          </MobileSidebar>
          <div className="design-phone-gesture" />
        </div>
      </ThemeRoot>

      {/* Scene 3: Settings */}
      <ThemeRoot className="design-phone-frame" {...theme}>
        <div className="design-phone-screen">
          <div className="design-phone-status"><span>9:41</span><span>●●●</span></div>
          <MobilePageHeader title={t("scenes.mobile.settings.title")} />
          <MobileSection title={t("scenes.mobile.settings.sectionGeneral")}>
            <MobileSwitch label={t("scenes.mobile.settings.notifications")} description={t("scenes.mobile.settings.notificationsDesc")} />
            <MobileSwitch label={t("scenes.mobile.settings.darkMode")} description={t("scenes.mobile.settings.darkModeDesc")} />
          </MobileSection>
          <MobileSection title={t("scenes.mobile.settings.sectionModel")}>
            <MobileListRow label={t("scenes.mobile.settings.model")} leading={<Icon name="settings" />} />
          </MobileSection>
          <div className="design-phone-gesture" />
        </div>
      </ThemeRoot>

      {/* Scene 4: Pairing */}
      <ThemeRoot className="design-phone-frame" {...theme}>
        <div className="design-phone-screen">
          <div className="design-phone-status"><span>9:41</span><span>●●●</span></div>
          <MobilePageHeader title={t("scenes.mobile.pairing.title")} subtitle={t("scenes.mobile.pairing.subtitle")} />
          <div className="design-phone-body">
            <MobileStatus tone="info" title={t("scenes.mobile.pairing.status")} description={t("scenes.mobile.pairing.statusDesc")} />
            <MobileTextField aria-label={t("scenes.mobile.pairing.codeLabel")} placeholder={t("scenes.mobile.pairing.codePlaceholder")} />
            <MobileButton appearance="primary" data-block="true">{t("scenes.mobile.pairing.connect")}</MobileButton>
          </div>
          <div className="design-phone-gesture" />
        </div>
      </ThemeRoot>
    </div>
  );
}

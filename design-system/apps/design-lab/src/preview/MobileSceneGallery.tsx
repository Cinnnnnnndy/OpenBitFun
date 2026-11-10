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

      {/* Scene 2: Session List */}
      <ThemeRoot className="design-phone-frame" {...theme}>
        <div className="design-phone-screen">
          <div className="design-phone-status"><span>9:41</span><span>●●●</span></div>
          <MobilePageHeader title={t("scenes.mobile.sessions.title")} subtitle={t("scenes.mobile.sessions.subtitle")} />
          <MobileSegmentedControl aria-label={t("scenes.mobile.sessions.segmented")} onChange={() => undefined} options={[{ label: t("scenes.mobile.sessions.tabChats"), value: "chats" }, { label: t("scenes.mobile.sessions.tabAgents"), value: "agents" }]} value="chats" />
          <div className="design-phone-thread">
            <MobileListRow label={t("scenes.mobile.sessions.session1")} leading={<Icon name="message-square" />} selected />
            <MobileListRow label={t("scenes.mobile.sessions.session2")} leading={<Icon name="code" />} />
            <MobileListRow label={t("scenes.mobile.sessions.session3")} leading={<Icon name="folder" />} />
          </div>
          <MobileTabBar label={t("scenes.mobile.tabBar")} items={[{ icon: <Icon name="message-square" />, label: t("scenes.mobile.tabChats"), value: "chats" }, { icon: <Icon name="gear" />, label: t("scenes.mobile.tabSettings"), value: "settings" }]} value="chats" />
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

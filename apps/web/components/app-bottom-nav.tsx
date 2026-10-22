"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { BottomNav, type BottomNavItem } from "@mwezicare/ui";
import {
  ClipboardList,
  LineChart,
  MessageCircle,
  MapPin,
  User,
} from "lucide-react";

export function AppBottomNav() {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const pathname = usePathname();

  const tabs: Array<{
    key: "track" | "insights" | "assistant" | "care" | "me";
    icon: BottomNavItem["icon"];
  }> = [
    { key: "track", icon: <ClipboardList size={20} /> },
    { key: "insights", icon: <LineChart size={20} /> },
    { key: "assistant", icon: <MessageCircle size={20} /> },
    { key: "care", icon: <MapPin size={20} /> },
    { key: "me", icon: <User size={20} /> },
  ];

  const items: BottomNavItem[] = tabs.map(({ key, icon }) => ({
    href: `/${locale}/${key}`,
    label: t(key),
    icon,
    active: pathname === `/${key}`,
  }));

  return <BottomNav items={items} ariaLabel={t("primary")} />;
}

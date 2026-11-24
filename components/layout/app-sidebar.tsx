'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Store,
  BarChart3,
  TrendingUp,
  Package,
  ShoppingBag,
  FolderTree,
  ArrowLeftRight,
  Radio,
  BookOpen,
  Database,
  ChevronDown,
} from 'lucide-react';
import { ARTICLES } from '@/lib/articles';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

const navItems = [
  { title: 'Обзор', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Live', href: '/dashboard/live', icon: Radio },
  { title: 'Магазины', href: '/dashboard/stores', icon: Store },
  { title: 'Динамика', href: '/dashboard/dynamics', icon: ArrowLeftRight },
  { title: 'ABC / XYZ', href: '/dashboard/abc-xyz', icon: BarChart3 },
  { title: 'Прибыльность', href: '/dashboard/profitability', icon: TrendingUp },
  { title: 'Склад', href: '/dashboard/inventory', icon: Package },
  { title: 'Товары', href: '/dashboard/products', icon: ShoppingBag },
  { title: 'Поставщики', href: '/dashboard/categories', icon: FolderTree },
];

export function AppSidebar() {
  const pathname = usePathname();
  // Сворачиваемые группы. Blog — закрыт по умолчанию.
  const isOnBlog = pathname.startsWith('/dashboard/blog');
  const [blogOpen, setBlogOpen] = React.useState(isOnBlog);
  React.useEffect(() => { if (isOnBlog) setBlogOpen(true); }, [isOnBlog]);

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700 text-white text-[11px] font-bold tracking-tight shadow-sm">
            1С
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[13px] font-semibold tracking-tight">1С Аналитика</span>
            <span className="text-[9.5px] font-medium text-muted-foreground tracking-widest uppercase">Retail</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Аналитика</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(item => {
                const isActive = pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));
                return (
                  <SidebarMenuItem key={item.href}>
                    <Link href={item.href}>
                      <SidebarMenuButton isActive={isActive}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Платформа</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <Link href="/dashboard/data">
                  <SidebarMenuButton isActive={pathname.startsWith('/dashboard/data')}>
                    <Database className="h-4 w-4" />
                    <span>Данные · ETL</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {/* Свёрнутая группа Исследований — клик по заголовку раскрывает */}
          <button
            type="button"
            onClick={() => setBlogOpen(v => !v)}
            className={cn(
              'flex w-full items-center justify-between px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground transition-colors',
            )}
          >
            <span>Исследования</span>
            <ChevronDown
              className={cn(
                'size-3 transition-transform',
                blogOpen ? 'rotate-0' : '-rotate-90'
              )}
            />
          </button>
          {blogOpen && (
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <Link href="/dashboard/blog">
                    <SidebarMenuButton isActive={pathname === '/dashboard/blog'}>
                      <BookOpen className="h-4 w-4" />
                      <span>Все статьи</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                {ARTICLES.map(a => {
                  const href = `/dashboard/blog/${a.slug}`;
                  const isActive = pathname === href;
                  return (
                    <SidebarMenuItem key={a.slug}>
                      <Link href={href}>
                        <SidebarMenuButton isActive={isActive} className="data-[active=true]:bg-sidebar-accent">
                          <span className="inline-flex h-4 w-4 items-center justify-center text-[13px] leading-none">
                            {a.sticker.emoji}
                          </span>
                          <span className="truncate text-[12.5px]">
                            <span className="font-mono text-muted-foreground mr-1.5">{a.num}</span>
                            {a.title.replace(/^\d+\s*·\s*/, '').split('—')[0].trim()}
                          </span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          )}
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t px-4 py-3">
        <p className="text-[10px] text-muted-foreground">
          1С Аналитика · v0.1
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { SiteHeader } from '@/components/layout/site-header';
import { DataProvider } from '@/lib/data-context';
import { DataLoaderOverlay } from '@/components/dashboard/data-loader-overlay';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <DataLoaderOverlay />
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <div className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </DataProvider>
  );
}

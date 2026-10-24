import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

export default function ChatPage() {
  return (
    <div className="flex h-dvh min-h-0 w-full">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize="66.67%">
          <div className="flex h-full items-center justify-center p-6">
            Dashboard
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize="33.33%">
          <div className="flex h-full items-center justify-center p-6">
            Chat
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

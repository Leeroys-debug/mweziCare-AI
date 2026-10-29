import { AskLearnSwitch } from "@/components/ask-learn-switch";
import { ChatThread } from "@/components/assistant/chat-thread";

export default function AssistantPage() {
  return (
    <div className="flex flex-col gap-4">
      <AskLearnSwitch />
      <ChatThread />
    </div>
  );
}

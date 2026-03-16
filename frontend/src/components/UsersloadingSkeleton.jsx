import { useChatStore } from "../store/useChatStore";

function ActiveTabSwitch() {
  const { activeTab, setActiveTab } = useChatStore();

  return (
    <div className="tabs tabs-boxed bg-transparent p-2 m-2">
      <button
        onClick={() => setActiveTab("chats")}
        className={`tab ${
          activeTab === "chats"
            ? "bg-cyan-500/20 text-cyan-400"
            : "text-slate-400"
        }`}
      >
        Chats
      </button>

      <button
        onClick={() => setActiveTab("contacts")}
        className={`tab ${
          activeTab === "contacts"
            ? "bg-cyan-500/20 text-cyan-400"
            : "text-slate-400"
        }`}
      >
        Contacts
      </button>
    </div>
  );
}
export default ActiveTabSwitch;
// This component is used to switch between the chats and contacts tabs in the chat sidebar.
// It uses the activeTab state from the chat store to determine which tab is currently active
//  and applies different styles accordingly. When a tab is clicked, it updates the activeTab state in the chat store.

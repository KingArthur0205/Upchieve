"use client";

import { useState } from "react";
import Modal from "./Modal";
import Tab1 from "../tabs/tab1";
import Tab2 from "../tabs/tab2";
import Tab3 from "../tabs/tab3";
import Tab4 from "../tabs/tab4";

export default function TabComponent() {
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const tabs = [
    { label: "Tab 1", key: "tab1", component: <Tab1 /> },
    { label: "Tab 2", key: "tab2", component: <Tab2 /> },
    { label: "Tab 3", key: "tab3", component: <Tab3 /> },
    { label: "Tab 4", key: "tab4", component: <Tab4 /> },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white">
      <h1 className="text-3xl mb-4">Meta-data about the lesson</h1>

      {/* Tab Buttons */}
      <div className="flex space-x-4 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 font-semibold text-lg rounded-md bg-gray-200 hover:bg-blue-500 hover:text-black"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Modal for Tabs */}
      <Modal isOpen={!!activeTab} onClose={() => setActiveTab(null)}>
        {tabs.find((tab) => tab.key === activeTab)?.component}
      </Modal>
    </div>
  );
}

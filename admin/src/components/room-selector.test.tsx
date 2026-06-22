import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { RoomSelector } from "./room-selector";
import { RoomState } from "../types";

const rooms: RoomState[] = [
  { id: "living-room", name: "Living Room", devices: [] },
  { id: "bedroom", name: "Bedroom", devices: [] },
  { id: "kitchen", name: "Kitchen", devices: [] },
];

function renderSelector(selected = ["living-room"], onChange = jest.fn()) {
  render(
    <RoomSelector rooms={rooms} selectedIds={selected} onChange={onChange} />,
  );
  return { onChange };
}

describe("RoomSelector", () => {
  it("renders a checkbox for each room", () => {
    renderSelector();
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(3);
  });

  it("shows the room name as label", () => {
    renderSelector();
    expect(screen.getByText("Living Room")).toBeInTheDocument();
    expect(screen.getByText("Bedroom")).toBeInTheDocument();
  });

  it("checks the initially selected room", () => {
    renderSelector(["bedroom"]);
    const bedroomCheckbox = screen.getAllByRole("checkbox")[1];
    expect(bedroomCheckbox).toBeChecked();
  });

  it("calls onChange with the new id added when unchecked room is clicked", () => {
    const { onChange } = renderSelector(["living-room"]);
    fireEvent.click(screen.getAllByRole("checkbox")[1]); // bedroom
    expect(onChange).toHaveBeenCalledWith(["living-room", "bedroom"]);
  });

  it("calls onChange with the id removed when checked room is clicked", () => {
    const { onChange } = renderSelector(["living-room", "bedroom"]);
    fireEvent.click(screen.getAllByRole("checkbox")[0]); // living-room
    expect(onChange).toHaveBeenCalledWith(["bedroom"]);
  });

  it("calls onChange with all ids when 'All' button is clicked", () => {
    const { onChange } = renderSelector([]);
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(onChange).toHaveBeenCalledWith(["living-room", "bedroom", "kitchen"]);
  });

  it("calls onChange with empty array when 'None' button is clicked", () => {
    const { onChange } = renderSelector(["living-room"]);
    fireEvent.click(screen.getByRole("button", { name: "None" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

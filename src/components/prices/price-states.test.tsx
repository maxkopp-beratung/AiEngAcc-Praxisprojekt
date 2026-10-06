import { fireEvent, render, screen } from "@testing-library/react";
import { PriceFooter } from "@/components/prices/price-footer";
import { PriceSectionSkeleton } from "@/components/prices/price-section-skeleton";
import { PricesErrorState, TomorrowEmptyState } from "@/components/prices/price-states";

describe("PriceSectionSkeleton (AC-22)", () => {
  it("marks the section as busy and announces the loading to screen readers", () => {
    const { container } = render(<PriceSectionSkeleton />);
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(screen.getByText("Strompreise werden geladen")).toHaveClass("sr-only");
  });

  it("shows three key-figure placeholders, no spinner", () => {
    const { container } = render(<PriceSectionSkeleton />);
    expect(container.querySelectorAll(".grid.sm\\:grid-cols-3 > *")).toHaveLength(3);
    expect(container.querySelector(".animate-spin")).toBeNull();
  });
});

describe("TomorrowEmptyState (AC-13)", () => {
  it("shows the heading and the exact sentence", () => {
    render(<TomorrowEmptyState />);
    expect(screen.getByRole("heading", { name: "Noch keine Preise für morgen" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Die Preise für morgen sind noch nicht veröffentlicht. Sie erscheinen meist ab ca. 13 Uhr.",
      ),
    ).toBeInTheDocument();
  });

  it("is not presented as an error", () => {
    const { container } = render(<TomorrowEmptyState />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(container.innerHTML).not.toContain("destructive");
  });
});

describe("PricesErrorState (AC-23)", () => {
  it("shows the exact text as an alert with a retry button", () => {
    render(<PricesErrorState onRetry={() => {}} retrying={false} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Die Strompreise konnten gerade nicht geladen werden.");
    expect(screen.getByText("Die Strompreise konnten gerade nicht geladen werden.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Erneut versuchen" })).toBeEnabled();
  });

  it("calls onRetry when the button is clicked", () => {
    const onRetry = vi.fn();
    render(<PricesErrorState onRetry={onRetry} retrying={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("disables the button and shows the loading label while retrying", () => {
    const onRetry = vi.fn();
    render(<PricesErrorState onRetry={onRetry} retrying />);
    const button = screen.getByRole("button", { name: "Wird geladen …" });
    expect(button).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Erneut versuchen" })).toBeNull();
    fireEvent.click(button);
    expect(onRetry).not.toHaveBeenCalled();
  });
});

describe("PriceFooter (AC-14, AC-15)", () => {
  it("shows the exact price hint", () => {
    render(<PriceFooter />);
    expect(
      screen.getByText("Reiner Börsenpreis ohne Netzentgelte, Steuern und Umlagen – dein Tarifpreis liegt höher."),
    ).toBeInTheDocument();
  });

  it("shows the source attribution", () => {
    render(<PriceFooter />);
    expect(
      screen.getByText((_, el) => el?.tagName === "P" && el.textContent === "Daten: Bundesnetzagentur | SMARD.de, über Energy-Charts, CC BY 4.0"),
    ).toBeInTheDocument();
  });

  it.each([
    ["Energy-Charts", "https://www.energy-charts.info"],
    ["CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"],
  ])("links %s to %s in a new tab, safely", (name, href) => {
    render(<PriceFooter />);
    const link = screen.getByRole("link", { name });
    expect(link).toHaveAttribute("href", href);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});

"""
Build revenue pivot: aggregate per month per product from Val Vol Rev - Product.xlsx
Output: Revenue_Pivot_By_Month_Product.xlsx with pivot table(s).

Run from this folder:
  pip install -r requirements.txt
  python build_revenue_pivot.py
"""
import pandas as pd
from pathlib import Path

EXCEL_PATH = Path(__file__).parent / "Val Vol Rev - Product.xlsx"
OUTPUT_PATH = Path(__file__).parent / "Revenue_Pivot_By_Month_Product.xlsx"


def excel_serial_to_datetime(ser):
    """Convert Excel serial date to pandas datetime."""
    return pd.to_datetime(ser - 2, unit="D", origin="1899-12-30")


def load_val_vol():
    """Load 'val vol' sheet: columns D (date), VOL, VAL_ZAR, CUSTOMER_BANK, PRODUCT."""
    df = pd.read_excel(EXCEL_PATH, sheet_name="val vol")
    cols = list(df.columns)
    if len(cols) >= 5:
        df = df.rename(columns={
            cols[0]: "Date",
            cols[1]: "VOL",
            cols[2]: "Revenue",
            cols[3]: "CustomerBank",
            cols[4]: "Product",
        })
    else:
        df.columns = ["Date", "VOL", "Revenue", "CustomerBank", "Product"][: len(cols)]
    df["Date"] = excel_serial_to_datetime(df["Date"])
    df["Month"] = df["Date"].dt.to_period("M").astype(str)
    return df[["Month", "Product", "Revenue"]].dropna(subset=["Revenue"])


def load_rev():
    """Load 'rev' sheet: date, revenue, product."""
    df = pd.read_excel(EXCEL_PATH, sheet_name="rev")
    cols = list(df.columns)
    if len(cols) >= 3:
        df = df.rename(columns={cols[0]: "Date", cols[1]: "Revenue", cols[2]: "Product"})
    else:
        df.columns = ["Date", "Revenue", "Product"][: len(cols)]
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df = df.dropna(subset=["Date", "Revenue"])
    df["Month"] = df["Date"].dt.to_period("M").astype(str)
    return df[["Month", "Product", "Revenue"]]


def main():
    try:
        data = load_val_vol()
    except Exception as e:
        print("val vol failed:", e)
        data = load_rev()

    # Pivot 1: Rows = Month, Columns = Product, Values = Sum(Revenue)
    pivot_wide = data.pivot_table(
        index="Month", columns="Product", values="Revenue", aggfunc="sum", fill_value=0
    )
    pivot_wide["Total"] = pivot_wide.sum(axis=1)
    pivot_wide.loc["Total"] = pivot_wide.sum(axis=0)

    # Pivot 2: Long format (Month, Product, Revenue)
    pivot_long = data.groupby(["Month", "Product"], as_index=False)["Revenue"].sum()
    pivot_long = pivot_long.sort_values(["Month", "Product"])

    with pd.ExcelWriter(OUTPUT_PATH, engine="openpyxl") as writer:
        pivot_wide.to_excel(writer, sheet_name="Pivot_Month_x_Product")
        pivot_long.to_excel(writer, sheet_name="Pivot_Long", index=False)

    print("Created:", OUTPUT_PATH)
    print("Sheets: Pivot_Month_x_Product (month × product), Pivot_Long (month, product, revenue)")
    return OUTPUT_PATH


if __name__ == "__main__":
    main()

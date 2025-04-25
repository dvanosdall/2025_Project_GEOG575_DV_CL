# This script filters a CSV file to keep only rows where the 'state' column is 'WI'.
# It saves the filtered data to a new CSV file in the same 'data' folder.
#
import csv
import os
from datetime import datetime

# Define base directory and data directory
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')

# Input and output file paths
input_file = os.path.join(DATA_DIR, 'wi_real_estate.csv')
output_file = os.path.join(DATA_DIR, 'filtered_wi_real_estate.csv')

# Define cutoff start and end dates
start_date = datetime(2017, 1, 31)
end_date = datetime(2024, 12, 31)

# Non-date columns to keep
non_date_columns = [
    'RegionID', 'SizeRank', 'RegionName', 'RegionType', 'StateName', 'State',
    'StateCodeFIPS', 'MunicipalCodeFIPS'
]

# Check if the string is a valid date in range
def is_valid_date(date_str, start_date, end_date):
    try:
        date = datetime.strptime(date_str, '%Y-%m-%d')
        return start_date <= date <= end_date
    except ValueError:
        return False

# Open the original CSV file
with open(input_file, mode='r', newline='') as infile:
    reader = csv.reader(infile)
    header = next(reader)

    # Create column name to index mapping
    column_indexes = {col: i for i, col in enumerate(header)}

    # Filter date columns between start and end dates
    date_columns = [col for col in header if is_valid_date(col, start_date, end_date)]

    # Combine final list of columns to extract
    filtered_header = [col for col in non_date_columns if col in column_indexes] + date_columns

    # Re-map filtered columns to their original index
    filtered_column_indexes = [column_indexes[col] for col in filtered_header]

    # Write filtered output
    with open(output_file, mode='w', newline='') as outfile:
        writer = csv.writer(outfile)
        writer.writerow(filtered_header)

        for row in reader:
            if row[column_indexes['State']] == 'WI':
                # Guard against short rows
                if len(row) < len(header):
                    row.extend([''] * (len(header) - len(row)))

                # Extract filtered values using correct indices
                filtered_row = [row[i] for i in filtered_column_indexes]
                writer.writerow(filtered_row)
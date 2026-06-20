import yfinance as yf
import pandas as pd
import pandas_ta as ta
import numpy as np
from sklearn.ensemble import RandomForestClassifier   # type: ignore
from sklearn.model_selection import train_test_split   # type: ignore
from skl2onnx import to_onnx     # type: ignore
from skl2onnx.common.data_types import FloatTensorType    # type: ignore

TICKERS= ["AAPL", "TSLA", "TCS.NS", "RELIANCE.NS"]

def fetch_and_prepare_data():
    all_data= []
    
    for ticker in TICKERS:
        print(f"Fetching historical data for {ticker}...")
        # Fetch 2 years of daily data
        df= yf.download(ticker, period= "2y", interval= "1d")
        if df.empty:
            continue
        
        # Clean columns (sometimes yfinance returns a MultiIndex)
        if isinstance(df.columns, pd.MultiIndex):
            df.columns= df.columns.get_level_values(0)
        
        df= df.copy()
        
        # Calculate technical indicators
        df.ta.rsi(close= "Close", length= 14, append= True)
        df.ta.macd(close= "Close", fast= 12, slow= 26, signal= 9, append= True)
        df.ta.ema(close= "Close", length= 20, append= True)
        
        # Calculate relative EMA: (Close - EMA_20) / EMA_20
        df["EMA_20_ratio"]= (df["Close"] - df["EMA_20"]) / df["EMA_20"]
        
        # Target: 1 if Close of the next day is higher than current Close, else 0
        df["target"]= (df["Close"].shift(-1) > df["Close"]).astype(int)
        
        # Drop rows with NaN values in our features
        feature_cols= ["RSI_14", "MACD_12_26_9", "MACDs_12_26_9", "EMA_20_ratio"]
        df= df.dropna(subset= feature_cols + ["target"])
        all_data.append(df[feature_cols + ["target"]])
    
    if not all_data:
        raise ValueError("No data fetched successfully.")
    combined_df= pd.concat(all_data, ignore_index= True)
    return combined_df

def main():
    print("Preparing training data...")
    data= fetch_and_prepare_data()
    
    X= data[["RSI_14", "MACD_12_26_9", "MACDs_12_26_9", "EMA_20_ratio"]].values.astype(np.float32)
    y= data["target"].values.astype(np.int64)
    
    print(f"Total samples gathered: {len(X)}")
    
    X_train, X_test, y_train, y_test= train_test_split(X, y, test_size= 0.2, random_state= 42)
    print("Training RandomForest model...")
    
    # Keep n_estimators and depth moderate so the ONNX file remains lightweight
    model= RandomForestClassifier(n_estimators= 50, max_depth= 6, random_state= 42)
    model.fit(X_train, y_train)
    
    train_acc= model.score(X_train, y_train)
    test_acc= model.score(X_test, y_test)
    print(f"Train Accuracy: {train_acc:.4f}")
    print(f"Test Accuracy: {test_acc:.4f}")
    
    print("Converting model to ONNX format...")
    
    # Define input types: FloatTensorType with shape [None, 4] (dynamic batch size, 4 features)
    initial_type= [('float_input', FloatTensorType([None, 4]))]
    onx= to_onnx(model, initial_types= initial_type, target_opset= 15)
    
    onnx_filename= "model.onnx"
    with open(onnx_filename, "wb") as f:
        f.write(onx.SerializeToString())
        
    print(f"Model successfully saved to {onnx_filename}!")
    
    # Verification check: Load with onnxruntime to ensure it runs correctly
    print("Verifying ONNX model runtime inference...")
    import onnxruntime as ort
    sess= ort.InferenceSession(onnx_filename)
    input_name= sess.get_inputs()[0].name
    
    # Run prediction on a test sample [RSI=50, MACD=0, MACDs=0, EMA_ratio=0]
    test_input= np.array([[50.0, 0.0, 0.0, 0.0]], dtype= np.float32)
    label, prob= sess.run(None, {input_name: test_input})
    print(f"ONNX Verification Result -> Predicted Label: {label}, Probability Mapping: {prob}")

if __name__ == "__main__":
    main()
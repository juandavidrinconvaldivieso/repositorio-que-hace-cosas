import random as rand
import streamlit as st

Name = st.text_input("Digite su nombre  ")
print("-"*10)
Age = st.number_input("Digite su edad     ")

print("-"*10)

if (Age >= 18):
    st.write(f"{Name} es un mayor de edad ({Age})")
else:
    st.write(f"{Name} es un menor de edad ({Age})")
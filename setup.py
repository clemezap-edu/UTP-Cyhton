from setuptools import setup, Extension
from Cython.Build import cythonize
import numpy
import os

# Extensiones Cython
extensions = [
    Extension(
        "cython_modules.busqueda_tabu",
        ["cython_modules/busqueda_tabu.pyx"],
        include_dirs=[numpy.get_include()],
        extra_compile_args=['-O3', '-march=native'],  # Optimización máxima
    )
]

setup(
    name='Sistema Horarios ITI',
    version='1.0',
    description='Sistema de generación de horarios universitarios con Búsqueda Tabú optimizada en Cython',
    author='Carlos Vargas, Eliezer Mores, Mauricio Garcia, Carlos Moncada',
    ext_modules=cythonize(extensions, 
                         compiler_directives={
                             'language_level': "3",
                             'boundscheck': False,
                             'wraparound': False,
                             'cdivision': True,
                             'embedsignature': True
                         }),
    zip_safe=False,
)

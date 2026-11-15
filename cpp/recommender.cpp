
#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <string>
#include <vector>

namespace py = pybind11;

struct Strategy {
    std::string name;
    std::string description;
    std::string benefits;
    std::string risks;
};

std::vector<Strategy> recommend(
    double soil_moisture,
    double rainfall_30d,
    const std::string& priority
) {
    std::vector<Strategy> strategies;

    if (soil_moisture < 0.15 || rainfall_30d < 30.0) {
        strategies.push_back({
            "Rotação resistente à seca",
            "Priorizar culturas com menor necessidade de água.",
            "Pode reduzir o risco de perdas em períodos secos.",
            "A escolha depende da cultura e das condições locais."
        });
    }

    if (priority == "soil_health" || priority == "soil_fertility") {
        strategies.push_back({
            "Rotação com leguminosas",
            "Incluir culturas leguminosas na rotação.",
            "Pode ajudar a melhorar a fertilidade do solo.",
            "Os resultados dependem do solo e da gestão agrícola."
        });
    }

    if (strategies.empty()) {
        strategies.push_back({
            "Rotação diversificada",
            "Alternar culturas com características diferentes.",
            "Pode reduzir a dependência de uma única cultura.",
            "É necessário considerar as condições locais."
        });
    }

    return strategies;
}

PYBIND11_MODULE(farm_engine, m) {
    py::class_<Strategy>(m, "Strategy")
        .def_readonly("name", &Strategy::name)
        .def_readonly("description", &Strategy::description)
        .def_readonly("benefits", &Strategy::benefits)
        .def_readonly("risks", &Strategy::risks);

    m.def("recommend", &recommend);
}